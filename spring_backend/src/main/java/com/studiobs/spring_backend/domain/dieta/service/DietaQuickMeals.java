package com.studiobs.spring_backend.domain.dieta.service;

import com.studiobs.spring_backend.domain.dieta.dto.meal.*;
import com.studiobs.spring_backend.domain.dieta.support.DietaIntakeSourceDocument;
import com.studiobs.spring_backend.domain.dieta.support.DietaIntakeSourceDocument.MacroTotals;
import com.studiobs.spring_backend.domain.dieta.repository.DietaRecipeRepository;
import com.studiobs.spring_backend.domain.dieta.service.DietaEntryStore.*;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;
import tools.jackson.databind.ObjectMapper;

@Service
@RequiredArgsConstructor
@Transactional(isolation = Isolation.READ_COMMITTED)
public class DietaQuickMeals {
    private final DietaService dieta;
    private final DietaEntryStore store;
    private final DietaRecipeRepository recipes;
    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;
    private final com.studiobs.spring_backend.domain.dieta.repository.DietaIntakeLogRepository intakes;

    public DietaActivityHistory.Suggestions activitySuggestions(String email, LocalDate date, String zone) {
        var user=dieta.requireUser(email).getId();
        dieta.requireProfile(user);
        dieta.checkEntryDay(user,date,zone);
        return dieta.activitySuggestions(user,date);
    }

    public record Week(int mealDays,int estimatedMealDays,int activityDays,int estimatedActivityDays,int workouts) {}
    @Transactional(readOnly=true, isolation=Isolation.REPEATABLE_READ)
    public Week week(String email, LocalDate end) {
        var user = dieta.requireUser(email).getId();
        dieta.requireProfile(user);
        var acts = dieta.activitiesInRange(user,end.minusDays(6),end);
        LocalDate start=end.minusDays(6);
        var recorded=new HashSet<>(jdbc.query("""
                SELECT logged_on FROM dieta_intake_logs WHERE user_id=? AND logged_on BETWEEN ? AND ?
                UNION SELECT logged_on FROM dieta_recipes WHERE user_id=? AND logged_on BETWEEN ? AND ? AND record_kind<>'LIBRARY'
                UNION SELECT logged_on FROM dieta_day_records WHERE user_id=? AND logged_on BETWEEN ? AND ?
                    AND record_key='ITEMS' AND JSON_LENGTH(payload)>0
                """,(r,n)->r.getDate(1).toLocalDate(),user.toString(),start,end,user.toString(),start,end,user.toString(),start,end));
        var estimateDays=new HashSet<LocalDate>();
        store.estimates(user,start,end).forEach(e->estimateDays.add(e.day()));
        int activities=0, actEst=0, workouts=0;
        for (var day=start; !day.isAfter(end); day=day.plusDays(1)) {
            var date=day;
            // Redis-only food from before the migration can still be live for 48 hours.
            if (!recorded.contains(day) && !day.isBefore(end.minusDays(2)) && !dieta.currentQueue(user,day).items().isEmpty())
                recorded.add(day);
            var row=acts.stream().filter(a->a.loggedOn().equals(date)).findFirst().orElse(null);
            if (row==null) continue;
            var fields=row.estimatedFields();
            if (row.activityName()!=null || row.steps()!=null && !fields.contains("steps")
                    || row.durationMin()!=null && !fields.contains("durationMin")
                    || row.exerciseKcal()!=null && !fields.contains("exerciseKcal")
                    || !row.splitCalories() && row.activityKcal()!=null) activities++;
            else if (!fields.isEmpty()) actEst++;
            if (row.activityName()!=null || row.durationMin()!=null && row.durationMin()>0 && !fields.contains("durationMin")
                    || row.exerciseKcal()!=null && row.exerciseKcal()>0 && !fields.contains("exerciseKcal")) workouts++;
        }
        estimateDays.removeAll(recorded);
        return new Week(recorded.size(),estimateDays.size(),activities,actEst,workouts);
    }

    @Transactional(readOnly=true, isolation=Isolation.REPEATABLE_READ)
    public Preview preview(String email, LocalDate day, String zone) {
        UUID user = dieta.requireUser(email).getId();
        dieta.requireProfile(user);
        dieta.checkEntryDay(user,day,zone);
        return preview(user,day);
    }

    private Preview preview(UUID user, LocalDate day) {
        var current = menu(user,day);
        var previous = menu(user,day.minusDays(1));
        var favorites = store.favorites(user);
        var estimates = new TreeMap<String,MacroTotals>();
        store.estimates(user,day,day).forEach(e -> estimates.put(e.meal(),e.value()));
        var averages = unclassifiedNutrition(user,day) ? List.<Average>of() : averages(user,day);
        var rev = store.hash(List.of(day,current,previous,favorites,estimates,averages,dieta.currentQueue(user,day).status()));
        return new Preview(day,day.minusDays(1),current,previous,favorites,averages,estimates,rev,UUID.randomUUID());
    }
    private boolean unclassifiedNutrition(UUID user, LocalDate day) {
        var existing=intakes.findByUserIdAndLoggedOn(user,day);
        return existing.map(row->{
            var doc=DietaIntakeSourceDocument.parse(mapper,row.getSourceMealsJson());
            return doc.queueTotals()!=null && doc.meals().isEmpty() || doc.analyzedRecipes().stream().anyMatch(r->!validLegacy(r))
                    || doc.queueTotals()==null && doc.recipeIds().isEmpty() && doc.analyzedRecipes().isEmpty();
        }).orElse(false) || dieta.dayRecipes(user,day).stream().anyMatch(r->r.getMealType()==null || !DietaEntryStore.MEALS.contains(r.getMealType()));
    }

    private List<Item> menu(UUID user, LocalDate day) {
        var list = new ArrayList<Item>();
        for (var i : dieta.currentQueue(user,day).items()) {
            String id=i.id().startsWith("base:") ? i.id().substring(5) : i.id();
            list.add(new Item(id,i.mealType(),i.text(),null,BigDecimal.ONE));
        }
        for (var r : dieta.dayRecipes(user,day)) {
            if (!DietaEntryStore.MEALS.contains(r.getMealType() == null ? "" : r.getMealType())) continue;
            var meta = store.read(user,day,"PORT:"+r.getId(),DietaService.RecipePortion.class);
            list.add(new Item(r.getId().toString(),r.getMealType(),r.getTitle(),
                    meta == null ? r.getId() : meta.source(),meta == null ? BigDecimal.ONE : meta.portion(),meta == null ? null : meta.legacy()));
        }
        var snapshot = legacyRecipes(user,day);
        for (int n=0;n<snapshot.size();n++) {
            var r=snapshot.get(n);
            if (validLegacy(r)) list.add(new Item("legacy:"+n,r.mealType(),r.title(),null,BigDecimal.ONE,r));
        }
        return list;
    }

    private List<DietaIntakeSourceDocument.AnalyzedRecipe> legacyRecipes(UUID user,LocalDate day) {
        var doc = intakes.findByUserIdAndLoggedOn(user,day)
                .map(r->DietaIntakeSourceDocument.parse(mapper,r.getSourceMealsJson())).orElse(null);
        if (doc==null || doc.analyzedRecipes().isEmpty()) return List.of();
        var ids=dieta.dayRecipes(user,day).stream().map(r->r.getId().toString()).toList();
        return doc.analyzedRecipes().stream().filter(r->!ids.contains(r.recipeId())).toList();
    }
    private static boolean validLegacy(DietaIntakeSourceDocument.AnalyzedRecipe r) {
        return r.title()!=null && r.mealType()!=null && DietaEntryStore.MEALS.contains(r.mealType())
                && r.carbG()!=null && r.proteinG()!=null && r.fatG()!=null;
    }
    private List<Average> averages(UUID user, LocalDate day) {
        var dates = jdbc.query("""
                SELECT logged_on FROM dieta_intake_logs WHERE user_id=? AND logged_on>=? AND logged_on<?
                UNION SELECT logged_on FROM dieta_recipes WHERE user_id=? AND logged_on>=? AND logged_on<? AND record_kind<>'LIBRARY'
                ORDER BY logged_on
                """,(r,n)->r.getDate(1).toLocalDate(),user.toString(),day.minusDays(28),day,user.toString(),day.minusDays(28),day);
        var samples = new TreeMap<String,List<MacroTotals>>();
        for (var date : dates) {
            if (unclassifiedNutrition(user,date)) continue;
            var values = new HashMap<String,MacroTotals>();
            var unknown = new HashSet<String>();
            var intake = dieta.completedIntake(user,date);
            if (intake != null) {
                var doc = DietaIntakeSourceDocument.parse(mapper,intake.getSourceMealsJson());
                var json = store.raw(user,date,"ANALYSIS");
                if (json != null) mapper.readTree(json).properties().forEach(e ->
                        values.put(e.getKey(),mapper.treeToValue(e.getValue(),MacroTotals.class)));
                else if (doc.meals().size() == 1) values.put(doc.meals().getFirst().mealType(),doc.queueTotals());
                if (doc.meals().isEmpty()) continue;
            }
            for (var item : dieta.currentQueue(user,date).items()) {
                if (!item.id().startsWith("base:") || !values.containsKey(item.mealType())) unknown.add(item.mealType());
            }
            for (var r : dieta.dayRecipes(user,date)) {
                if (r.getMealType()!=null) values.merge(r.getMealType(),DietaService.recipeNutrition(r),MacroTotals::plus);
            }
            for (var r : legacyRecipes(user,date)) {
                if (validLegacy(r)) values.merge(r.mealType(),new MacroTotals(r.carbG(),r.proteinG(),r.fatG(),r.kcal()),MacroTotals::plus);
            }
            values.forEach((type,t) -> { if (!unknown.contains(type)) samples.computeIfAbsent(type,k->new ArrayList<>()).add(t); });
        }
        var result = new ArrayList<Average>();
        samples.forEach((type,values)->{
            if (values.size() >= 3) result.add(new Average(type,values.size(),DietaEntryStore.scale(
                    values.stream().reduce(MacroTotals.zero(), MacroTotals::plus),
                    BigDecimal.ONE.divide(BigDecimal.valueOf(values.size()),12,RoundingMode.HALF_UP))));
        });
        return result;
    }

    public void apply(String email, LocalDate day, String zone, Edit edit) {
        var user = dieta.requireUser(email).getId();
        dieta.requireProfile(user);
        if (edit.requestId()==null || edit.action()==null) throw DietaEntryStore.invalid("저장할 항목을 확인해 주세요.");
        String key = "REQ:"+edit.requestId();
        String fingerprint = store.hash(edit);
        String old = store.read(user,day,key,String.class);
        if (old != null) {
            if (!old.equals(fingerprint)) throw DietaEntryStore.stale();
            return;
        }
        dieta.checkEntryDay(user,day,zone);
        var p = preview(user,day);
        if (!p.revision().equals(edit.revision())) throw DietaEntryStore.stale();
        var favorite = p.favorites().stream().filter(f->f.id().equals(edit.favoriteId())).findFirst().orElse(null);
        if (edit.favoriteId()!=null && favorite==null) throw DietaEntryStore.stale();
        if ("pending".equals(dieta.currentQueue(user,day).status())) throw DietaEntryStore.stale();
        switch (edit.action()) {
            case "estimate" -> {
                if (p.current().stream().anyMatch(i->i.mealType().equals(edit.mealType()))) throw DietaEntryStore.stale();
                var avg = p.averages().stream().filter(a->a.mealType().equals(edit.mealType())).findFirst().orElseThrow(DietaEntryStore::stale);
                store.write(user,day,"EST:"+avg.mealType(),DietaEntryStore.scale(avg.totals(),portion(edit.portion())));
            }
            case "clearEstimate" -> store.clearEstimate(user,day,edit.mealType());
            case "deleteFavorite" -> { if (favorite==null) throw DietaEntryStore.stale(); store.deleteFavorite(user,favorite.id()); }
            case "saveFavorite" -> {
                if (edit.name()==null || edit.name().isBlank() || edit.name().length()>80) throw DietaEntryStore.invalid("식사 이름을 입력해 주세요.");
                var choices = new ArrayList<>(p.current());
                if (favorite!=null) choices.addAll(favorite.items());
                var selected = select(choices,edit.picks()).stream().map(i->snapshotFavorite(user,i)).toList();
                store.saveFavorite(user,favorite==null ? UUID.randomUUID():favorite.id(),edit.name().trim(),selected);
            }
            case "previous", "favorite" -> {
                boolean previous = edit.action().equals("previous");
                if (!previous && favorite==null) throw DietaEntryStore.stale();
                var items = select(previous ? p.previous() : favorite.items(),edit.picks());
                for (var item : items) {
                    String origin = store.hash(List.of(previous ? p.previousDay().toString():favorite.id().toString(),item.id(),item.mealType()));
                    if (store.raw(user,day,"COPY:"+origin)!=null) throw DietaEntryStore.invalid("이 끼니에 이미 가져온 항목이 있어요.");
                    if(item.legacy()!=null) {
                        var r=item.legacy();
                        var source=com.studiobs.spring_backend.domain.dieta.entity.DietaRecipe.builder()
                                .title(r.title()).ingredientsJson(mapper.writeValueAsString(r.ingredients())).steps(r.steps())
                                .carbG(r.carbG()).proteinG(r.proteinG()).fatG(r.fatG()).kcal(r.kcal()).oneLineReview(r.oneLineReview()).build();
                        dieta.copyRecipe(user,source,day,item.mealType(),item.portion(),r);
                    } else if (item.recipeId()==null) dieta.addMealQueueItem(email,new DietaMealQueueAddItemRequest(day,item.mealType(),item.text()));
                    else {
                        var recipe = recipes.findById(item.recipeId()).filter(r->r.getUserId().equals(user)).orElseThrow(DietaEntryStore::stale);
                        dieta.copyRecipe(user,recipe,day,item.mealType(),item.portion());
                    }
                    store.write(user,day,"COPY:"+origin,true);
                }
                if (!previous) store.useFavorite(user,favorite.id());
            }
            default -> throw DietaEntryStore.invalid("지원하지 않는 입력 방식이에요.");
        }
        dieta.checkEntryDay(user,day,zone);
        store.write(user,day,key,fingerprint);
    }

    private Item snapshotFavorite(UUID user, Item item) {
        if (item.recipeId()==null || item.legacy()!=null) return item;
        var recipe=recipes.findById(item.recipeId()).filter(r->r.getUserId().equals(user)).orElseThrow(DietaEntryStore::stale);
        var snapshot=new DietaIntakeSourceDocument.AnalyzedRecipe(recipe.getId().toString(),item.mealType(),recipe.getTitle(),
                recipe.getIngredientsJson()==null?List.of():List.of(mapper.readValue(recipe.getIngredientsJson(),String[].class)),
                recipe.getSteps(),recipe.getCarbG(),recipe.getProteinG(),recipe.getFatG(),recipe.getKcal(),recipe.getOneLineReview(),null);
        return new Item(item.id(),item.mealType(),item.text(),item.recipeId(),item.portion(),snapshot);
    }

    private static BigDecimal portion(BigDecimal value) {
        if (value==null || value.signum()<=0 || value.compareTo(BigDecimal.TEN)>0 || value.scale()>2)
            throw DietaEntryStore.invalid("분량은 0.01~10 사이로 입력해 주세요.");
        return value;
    }
    private List<Item> select(List<Item> choices, List<Pick> picks) {
        if (picks==null || picks.isEmpty() || picks.size()>100) throw DietaEntryStore.invalid("음식을 1~100개 선택해 주세요.");
        var result = new ArrayList<Item>();
        var seen = new HashSet<String>();
        for (var pick : picks) {
            if (pick==null || pick.mealType()==null || !DietaEntryStore.MEALS.contains(pick.mealType()) || !seen.add(pick.id()))
                throw DietaEntryStore.invalid("음식과 끼니를 확인해 주세요.");
            var original = choices.stream().filter(i->i.id().equals(pick.id())).findFirst().orElseThrow(DietaEntryStore::stale);
            boolean recipe=original.recipeId()!=null || original.legacy()!=null;
            String text = !recipe ? pick.text() : original.text();
            if (text==null || text.isBlank() || text.length()>1000) throw DietaEntryStore.invalid("음식 내용을 확인해 주세요.");
            result.add(new Item(original.id(),pick.mealType(),text.trim(),original.recipeId(),
                    !recipe ? BigDecimal.ONE : portion(pick.portion()),original.legacy()));
        }
        return result;
    }
}
