package com.studiobs.spring_backend.domain.dieta.service;

import com.studiobs.spring_backend.domain.dieta.dto.meal.DietaMealQueueItemDto;
import com.studiobs.spring_backend.domain.dieta.support.DietaIntakeSourceDocument.MacroTotals;
import com.studiobs.spring_backend.global.exception.BusinessException;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import tools.jackson.databind.ObjectMapper;

@Repository
@RequiredArgsConstructor
public class DietaEntryStore {
    public record Item(String id, String mealType, String text, UUID recipeId, BigDecimal portion,
                       com.studiobs.spring_backend.domain.dieta.support.DietaIntakeSourceDocument.AnalyzedRecipe legacy) {
        Item(String id,String mealType,String text,UUID recipeId,BigDecimal portion) { this(id,mealType,text,recipeId,portion,null); }
    }
    public record Favorite(UUID id, String name, List<Item> items) {}
    public record Average(String mealType, int days, MacroTotals totals) {}
    public record Preview(LocalDate day, LocalDate previousDay, List<Item> current, List<Item> previous,
                          List<Favorite> favorites, List<Average> averages, Map<String,MacroTotals> estimates, String revision, UUID requestId) {}
    public record Pick(String id, String mealType, String text, BigDecimal portion) {}
    public record Edit(UUID requestId, String revision, String action, UUID favoriteId, String name,
                       List<Pick> picks, String mealType, BigDecimal portion) {}
    static final List<String> MEALS = List.of("BREAKFAST","LUNCH","DINNER","SNACK");
    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;

    public static BusinessException invalid(String message) { return new BusinessException(HttpStatus.BAD_REQUEST, message); }
    static BusinessException stale() { return new BusinessException(HttpStatus.CONFLICT, "기록이 변경됐어요. 다시 열어 확인해 주세요."); }

    String hash(Object data) {
        try {
            return HexFormat.of().formatHex(java.security.MessageDigest.getInstance("SHA-256").digest(mapper.writeValueAsBytes(data)));
        } catch (java.security.NoSuchAlgorithmException e) { throw new IllegalStateException(e); }
    }
    String raw(UUID user, LocalDate day, String key) {
        return jdbc.query("SELECT payload FROM dieta_day_records WHERE user_id=? AND logged_on=? AND record_key=?",
                (r,n)->r.getString(1),user.toString(),day,key).stream().findFirst().orElse(null);
    }
    <T> T read(UUID user, LocalDate day, String key, Class<T> type) {
        var json = raw(user,day,key);
        return json == null ? null : mapper.readValue(json,type);
    }
    void write(UUID user, LocalDate day, String key, Object value) {
        jdbc.update("""
                INSERT INTO dieta_day_records(user_id,logged_on,record_key,payload) VALUES(?,?,?,?)
                ON DUPLICATE KEY UPDATE payload=VALUES(payload)
                """,user.toString(),day,key,mapper.writeValueAsString(value));
    }
    Map<String,DietaMealJournal.Status> mealStatuses(UUID user,LocalDate day) {
        var selected=read(user,day,"MEAL_STATUS_V1",DietaMealJournal.Selections.class);
        return selected==null ? Map.of() : selected.values();
    }
    void setMealStatus(UUID user,LocalDate day,String meal,DietaMealJournal.Status status) {
        var values=new TreeMap<>(mealStatuses(user,day));
        if (values.get(meal)==status) return;
        if (status==null) values.remove(meal); else values.put(meal,status);
        write(user,day,"MEAL_STATUS_V1",new DietaMealJournal.Selections(values));
    }

    void clearEstimate(UUID user, LocalDate date, String meal) {
        jdbc.update("DELETE FROM dieta_day_records WHERE user_id=? AND logged_on=? AND record_key=?",
                user.toString(),date,"EST:"+meal);
    }
    List<DietaMealQueueItemDto> items(UUID user, LocalDate day, List<DietaMealQueueItemDto> fallback) {
        var items = read(user,day,"ITEMS",DietaMealQueueItemDto[].class);
        return items == null ? fallback : List.of(items);
    }
    Map<LocalDate,String> recordsInRange(UUID user, LocalDate start, LocalDate end, String key) {
        var result=new HashMap<LocalDate,String>();
        jdbc.query("""
                SELECT logged_on,payload FROM dieta_day_records WHERE user_id=? AND logged_on BETWEEN ? AND ?
                AND record_key=?
                """,(org.springframework.jdbc.core.RowCallbackHandler)r->
                result.put(r.getDate(1).toLocalDate(),r.getString(2)),user.toString(),start,end,key);
        return result;
    }
    Map<LocalDate,Map<String,String>> journalRange(UUID user,LocalDate start,LocalDate end) {
        var records=new HashMap<LocalDate,Map<String,String>>();
        jdbc.query("""
                SELECT logged_on,record_key,payload FROM dieta_day_records
                WHERE user_id=? AND logged_on BETWEEN ? AND ? AND
                (record_key IN ('ITEMS','FOODS_V1','REFLECTED','MEAL_STATUS_V1','FEEDBACK_V1') OR record_key LIKE 'EST:%')
                """,(org.springframework.jdbc.core.RowCallbackHandler)row->
                records.computeIfAbsent(row.getDate(1).toLocalDate(),k->new HashMap<>())
                        .put(row.getString(2),row.getString(3)),user.toString(),start,end);
        return records;
    }

    Map<String,List<Integer>> feedbackHistory(UUID user, LocalDate day) {
        var samples=new HashMap<String,List<Integer>>();
        // Legacy ANALYSIS contains queue-only totals. Include it only on days with no recipe or estimate.
        jdbc.query("""
                SELECT f.payload, a.payload FROM dieta_intake_logs i
                LEFT JOIN dieta_day_records f ON f.user_id=i.user_id AND f.logged_on=i.logged_on AND f.record_key='FEEDBACK_V1'
                LEFT JOIN dieta_day_records a ON a.user_id=i.user_id AND a.logged_on=i.logged_on AND a.record_key='ANALYSIS'
                WHERE i.user_id=? AND i.logged_on>=? AND i.logged_on<? AND (f.payload IS NOT NULL OR
                (a.payload IS NOT NULL AND COALESCE(JSON_LENGTH(i.source_meals_json,'$.analyzedRecipes'),0)=0
                 AND COALESCE(JSON_LENGTH(i.source_meals_json,'$.recipeIds'),0)=0
                 AND NOT EXISTS (SELECT 1 FROM dieta_recipes r WHERE r.user_id=i.user_id AND r.logged_on=i.logged_on AND r.record_kind<>'LIBRARY')
                 AND NOT EXISTS (SELECT 1 FROM dieta_day_records e WHERE e.user_id=i.user_id AND e.logged_on=i.logged_on
                    AND (e.record_key LIKE 'EST:%' OR (e.record_key='ITEMS' AND
                    (JSON_SEARCH(e.payload,'one','extra:%',NULL,'$[*].id') IS NOT NULL OR JSON_SEARCH(e.payload,'one','note:%',NULL,'$[*].id') IS NOT NULL)))) ))
                """,(org.springframework.jdbc.core.RowCallbackHandler) row->{
            boolean snapshot=row.getString(1)!=null;
            var values=snapshot ? mapper.readTree(row.getString(1)).path("comparableKcal") : mapper.readTree(row.getString(2));
            for (String meal:MEALS) {
                var kcal=snapshot ? values.path(meal) : values.path(meal).path("kcal");
                if (kcal.isIntegralNumber() && kcal.canConvertToInt() && kcal.asInt()>=0)
                    samples.computeIfAbsent(meal,key->new ArrayList<>()).add(kcal.asInt());
            }
        },user.toString(),day.minusDays(28),day);
        return samples;
    }

    record Estimate(LocalDate day, String meal, MacroTotals value) {}
    List<Estimate> estimates(UUID user, LocalDate start, LocalDate end) {
        return jdbc.query("""
                SELECT logged_on,record_key,payload FROM dieta_day_records
                WHERE user_id=? AND logged_on BETWEEN ? AND ? AND record_key LIKE 'EST:%' ORDER BY logged_on,record_key
                """,(r,n)->new Estimate(r.getDate(1).toLocalDate(), r.getString(2).substring(4),
                    mapper.readValue(r.getString(3),MacroTotals.class)),user.toString(),start,end);
    }
    List<Favorite> favorites(UUID user) {
        return jdbc.query("SELECT id,name,items FROM dieta_favorite_meals WHERE user_id=? ORDER BY used_at DESC,id",
                (r,n)->new Favorite(UUID.fromString(r.getString(1)),r.getString(2),List.of(mapper.readValue(r.getString(3),Item[].class))), user.toString());
    }
    void saveFavorite(UUID user, UUID id, String name, List<Item> items) {
        jdbc.update("""
                INSERT INTO dieta_favorite_meals(user_id,id,name,items,used_at) VALUES(?,?,?,?,UTC_TIMESTAMP(6))
                ON DUPLICATE KEY UPDATE name=VALUES(name),items=VALUES(items),used_at=UTC_TIMESTAMP(6)
                """,user.toString(),id.toString(),name, mapper.writeValueAsString(items));
    }
    void useFavorite(UUID user, UUID id) {
        jdbc.update("UPDATE dieta_favorite_meals SET used_at=UTC_TIMESTAMP(6) WHERE user_id=? AND id=?",user.toString(),id.toString());
    }
    void deleteFavorite(UUID user, UUID id) {
        jdbc.update("DELETE FROM dieta_favorite_meals WHERE user_id=? AND id=?",user.toString(),id.toString());
    }
    static MacroTotals scale(MacroTotals t, BigDecimal scale) {
        return new MacroTotals(t.carbG().multiply(scale).setScale(1,java.math.RoundingMode.HALF_UP),
                t.proteinG().multiply(scale).setScale(1,java.math.RoundingMode.HALF_UP),
                t.fatG().multiply(scale).setScale(1,java.math.RoundingMode.HALF_UP),
                BigDecimal.valueOf(t.kcal()).multiply(scale).setScale(0,java.math.RoundingMode.HALF_UP).intValueExact());
    }
}
