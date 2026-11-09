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
    void clearEstimate(UUID user, LocalDate date, String meal) {
        jdbc.update("DELETE FROM dieta_day_records WHERE user_id=? AND logged_on=? AND record_key=?",
                user.toString(),date,"EST:"+meal);
    }
    List<DietaMealQueueItemDto> items(UUID user, LocalDate day, List<DietaMealQueueItemDto> fallback) {
        var items = read(user,day,"ITEMS",DietaMealQueueItemDto[].class);
        return items == null ? fallback : List.of(items);
    }
    Map<LocalDate,String> activityMetadata(UUID user, LocalDate start, LocalDate end) {
        var result=new HashMap<LocalDate,String>();
        jdbc.query("""
                SELECT logged_on,payload FROM dieta_day_records WHERE user_id=? AND logged_on BETWEEN ? AND ?
                AND record_key='ACTIVITY'
                """,(org.springframework.jdbc.core.RowCallbackHandler)r->
                result.put(r.getDate(1).toLocalDate(),r.getString(2)),user.toString(),start,end);
        return result;
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
