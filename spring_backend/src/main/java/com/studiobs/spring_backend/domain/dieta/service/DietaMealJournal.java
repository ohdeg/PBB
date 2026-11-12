package com.studiobs.spring_backend.domain.dieta.service;

import com.studiobs.spring_backend.domain.dieta.dto.meal.DietaMealQueueDayResponse;
import java.util.*;

public final class DietaMealJournal {
    public enum Status { COMPLETE, SKIPPED, UNKNOWN }
    public record Change(Status status, Status expected) {}
    public record Selections(Map<String,Status> values) {}
    public record WeekMeal(String mealType,int directDays,int estimatedDays,int mixedDays,int skippedDays,int unknownDays,
                           String frequentFood,int foodDays, Trend trend) {}
    public record Trend(long earlyAverage,int earlyDays,long lateAverage,int lateDays) {}
    static final List<String> MAIN=List.of("BREAKFAST","LUNCH","DINNER");

    static boolean hasFood(DietaMealDay day,String meal) {
        return day.mealTotals().containsKey(meal) || day.foods().stream().anyMatch(r->meal.equals(r.mealType()));
    }

    static void validate(String meal,Change change,DietaMealDay day) {
        if (!MAIN.contains(meal)) throw DietaEntryStore.invalid("아침·점심·저녁 중에서 선택해 주세요.");
        if (change.status()!=null && (change.status()==Status.COMPLETE)!=hasFood(day,meal))
            throw DietaEntryStore.invalid(change.status()==Status.COMPLETE ? "먼저 식사를 기록해 주세요." : "음식이 있는 끼니예요. 기록을 확인해 주세요.");
        var current=day.mealStatuses().get(meal);
        if (current!=change.expected() && current!=change.status()) throw DietaEntryStore.stale();
    }

    static void checkPreview(DietaMealQueueDayResponse queue,List<String> ids) {
        var actual=queue.items().stream().map(i->i.id()).filter(id->id.startsWith("extra:")).toList();
        if (!actual.equals(ids)) throw DietaEntryStore.stale();
    }

    static final class Day {
        final Set<String> direct=new HashSet<>();
        final Set<String> estimates=new HashSet<>();
        final Map<String,Set<String>> foods=new HashMap<>();
        Map<String,Status> statuses=Map.of();
        Map<String,Integer> analysedKcal=Map.of();

        void record(String meal,String food) {
            if (meal==null || !DietaEntryStore.MEALS.contains(meal)) return;
            direct.add(meal);
            if (food!=null && !food.isBlank()) foods.computeIfAbsent(meal,k->new HashSet<>()).add(food.trim());
        }
    }

    static List<WeekMeal> summarize(List<Day> days) {
        var result=new ArrayList<WeekMeal>();
        for (var meal:DietaEntryStore.MEALS) {
            int direct=0, estimated=0, mixed=0, skipped=0, unknown=0;
            var names=new TreeMap<String,Integer>();
            var early=new IntSummaryStatistics();
            var late=new IntSummaryStatistics();
            for (int index=0; index<days.size(); index++) {
                var day=days.get(index);
                boolean average=day.estimates.contains(meal);
                boolean recorded=day.direct.contains(meal);
                if (recorded && average) mixed++;
                else if (recorded) direct++;
                else if (average) estimated++;
                else if (day.statuses.get(meal)==Status.SKIPPED) skipped++;
                else if (day.statuses.get(meal)==Status.UNKNOWN) unknown++;
                var kcal=day.analysedKcal.get(meal);
                if (days.size()==7 && recorded && !average && kcal!=null) {
                    if (index<3) early.accept(kcal);
                    if (index>=4) late.accept(kcal);
                }
                day.foods.getOrDefault(meal,Set.of()).forEach(n->names.merge(n,1,Integer::sum));
            }
            var frequent=direct+mixed>=3 ? names.entrySet().stream().filter(e->e.getValue()>=2)
                    .max(Map.Entry.comparingByValue()).orElse(null) : null;
            var trend=early.getCount()>=2 && late.getCount()>=2
                    ? new Trend(Math.round(early.getAverage()),(int)early.getCount(),Math.round(late.getAverage()),(int)late.getCount()) : null;
            result.add(new WeekMeal(meal,direct,estimated,mixed,skipped,unknown,
                    frequent==null?null:frequent.getKey(),frequent==null?0:frequent.getValue(),trend));
        }
        return result;
    }
}
