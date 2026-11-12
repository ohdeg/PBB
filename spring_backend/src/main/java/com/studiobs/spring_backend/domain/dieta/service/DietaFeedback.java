package com.studiobs.spring_backend.domain.dieta.service;

import java.util.*;
import tools.jackson.databind.JsonNode;

public record DietaFeedback(String dayReview, Map<String,String> meals, String inputVersion, int targetKcal, Map<String,Integer> comparableKcal,
        Map<String,Comparison> comparisons, String activityVersion, int intakeKcal) {
    public record Comparison(long averageKcal,int days) {}
    private static final java.util.regex.Pattern COUNT=java.util.regex.Pattern.compile("([2-9]|[1-9][0-9]) *(조각|개|장)");

    private static final Map<String,String> LABELS=Map.of("BREAKFAST","아침","LUNCH","점심","DINNER","저녁","SNACK","간식");

    static DietaFeedback create(DietaMealDay day, int target, Map<String,List<Integer>> history,
            JsonNode hints, DietaFoodDetails details, String version, com.studiobs.spring_backend.domain.dieta.dto.DietaActivityLogResponse activity) {
        var meals=new LinkedHashMap<String,String>();
        var comparable=new TreeMap<String,Integer>();
        var comparisons=new TreeMap<String,Comparison>();
        boolean portionUsed=false;
        String comparison=null;
        long largestDifference=0;
        for (String meal:List.of("BREAKFAST","LUNCH","DINNER","SNACK")) {
            var rows=day.foods().stream().filter(r->meal.equals(r.mealType())).toList();
            var total=day.mealTotals().get(meal);
            if (rows.isEmpty() && total==null) continue;
            String label=LABELS.get(meal);
            boolean estimated=rows.stream().anyMatch(r->"average".equals(r.source()));
            if (total==null) {
                meals.put(meal,label+" 기록은 있지만 끼니별 영양 소계를 확인하기 어려워요.");
                continue;
            }
            String description=label+"의 기록 열량은 "+total.kcal()+" kcal예요.";
            if (estimated) description=label+" 소계 "+total.kcal()+" kcal에는 평소 섭취량으로 채운 추정치가 포함돼요.";
            else if (!rows.isEmpty() && rows.stream().allMatch(r->r.nutrition()!=null)) {
                var top=rows.stream().max(Comparator.comparingInt(r->r.nutrition().kcal())).orElseThrow();
                var protein=rows.stream().max(Comparator.comparing(r->r.nutrition().proteinG())).orElseThrow();
                if (protein.nutrition().proteinG().signum()>0 && proteinHint(day,meal,protein,hints,details))
                    description=protein.name()+"에서 단백질 약 "+protein.nutrition().proteinG().stripTrailingZeros().toPlainString()+" g을 섭취한 것으로 추정해요.";
                else {
                    String portion=top.portion()==null?"":("estimatedPortion".equals(top.source())?" 약 ":" ")+top.portion();
                    description=top.name()+portion+"의 열량은 약 "+top.nutrition().kcal()+" kcal예요.";
                    if (rows.size()>1 && total.kcal()>0) description=top.name()+portion+"이 "+label+" 열량의 약 "
                            +Math.round(100.0*top.nutrition().kcal()/total.kcal())+"%를 차지했어요.";
                    if (!portionUsed && "analysed".equals(top.source()) && top.portion()!=null) {
                        var count=COUNT.matcher(top.portion());
                        // Only derive a unit value if this food and portion were both present in a recorded item.
                        if (count.matches() && day.queue().items().stream().anyMatch(i->meal.equals(i.mealType())
                                && i.text().contains(top.name()) && i.text().contains(top.portion()))) {
                            long one=Math.round(top.nutrition().kcal()/(double)Integer.parseInt(count.group(1)));
                            description=top.name()+" "+top.portion()+"은 약 "+top.nutrition().kcal()+" kcal로, 한 "+count.group(2)+"당 약 "+one+" kcal예요.";
                            portionUsed=true;
                        }
                    }
                }
            }
            meals.put(meal,description);
            var past=history.getOrDefault(meal,List.of());
            if (!estimated && rows.stream().noneMatch(r->"unanalysed".equals(r.source())) && day.foods().stream().allMatch(r->r.mealType()!=null))
                comparable.put(meal,total.kcal());
            if (comparable.containsKey(meal) && past.size()>=3) {
                long mean=Math.round(past.stream().mapToInt(Integer::intValue).average().orElseThrow());
                comparisons.put(meal,new Comparison(mean,past.size()));
                long delta=total.kcal()-mean;
                if (Math.abs(delta)>largestDifference) {
                    largestDifference=Math.abs(delta);
                    comparison=label+" 기록은 지난 28일 중 "+past.size()+"일의 "+label+" 분석 평균보다 "+Math.abs(delta)+" kcal "+(delta>0?"높았어요.":"낮았어요.");
                }
            }
        }
        String review;
        if (meals.size()==1 && day.foods().stream().allMatch(r->r.mealType()!=null))
            review="이날 분석에는 "+LABELS.get(meals.keySet().iterator().next())+"만 포함됐어요.";
        else if (comparison!=null) review=comparison;
        else if (comparable.size()>1 && comparable.size()==meals.size() && day.intake().kcal()>0 &&
                comparable.values().stream().mapToLong(Integer::longValue).sum()==day.intake().kcal()) {
            var largest=Collections.max(comparable.entrySet(),Map.Entry.comparingByValue());
            review=LABELS.get(largest.getKey())+"가 기록된 하루 섭취량의 약 "
                    +Math.round(100.0*largest.getValue()/day.intake().kcal())+"%를 차지했어요.";
        }
        else review="이날 기록된 섭취량은 "+day.intake().kcal()+" kcal예요.";
        if (comparison==null || meals.size()==1) {
            int delta=day.intake().kcal()-target;
            if (target>0) review+=" 기록 기준으로 하루 목표 "+target+" kcal"+(delta==0?"와 같아요.":"보다 "+Math.abs(delta)+" kcal "+(delta>0?"많아요.":"적어요."));
        }
        if (!day.mealStatuses().isEmpty()) {
            var coverage=new ArrayList<String>();
            for (String meal:DietaMealJournal.MAIN) {
                var status=day.mealStatuses().get(meal);
                if (status==DietaMealJournal.Status.SKIPPED) coverage.add(LABELS.get(meal)+" 건너뜀");
                else if (status==DietaMealJournal.Status.UNKNOWN) coverage.add(LABELS.get(meal)+" 기억 안 남");
                else if (!DietaMealJournal.hasFood(day,meal)) coverage.add(LABELS.get(meal)+" 미기록");
            }
            if (!coverage.isEmpty()) review+=" 분석 시점의 기록 상태는 "+String.join(" · ",coverage)+"이에요.";
        }
        String activityVersion=null;
        if (meals.size()>1 && activity!=null && activity.workouts()!=null && !activity.workouts().isEmpty()) {
            var movement=activity.workouts().size()==1 ? activity.workouts().getFirst().name() : "운동 "+activity.workouts().size()+"회";
            if (activity.exerciseKcal()!=null) movement+=" · 입력한 운동 열량 "+activity.exerciseKcal()+" kcal";
            if (activity.missingExerciseKcal()>0) movement+=" (열량 "+activity.missingExerciseKcal()+"건 미입력)";
            review+=" 이날 활동 기록은 "+movement+"예요.";
            activityVersion=activity.revision();
        }
        return new DietaFeedback(review,meals,version,target,comparable,comparisons,activityVersion,day.intake().kcal());
    }

    private static boolean proteinHint(DietaMealDay day,String meal,DietaMealDay.Row row,JsonNode hints,DietaFoodDetails details) {
        if (hints==null || !hints.isArray() || details==null) return false;
        for (var hint:hints) {
            if (!meal.equals(hint.path("mealType").asString("")) || !"protein".equals(hint.path("kind").asString(""))) continue;
            String id=hint.path("entryId").asString("");
            if (day.queue().items().stream().noneMatch(i->meal.equals(i.mealType()) && i.id().equals("base:"+id))) continue;
            if (details.entries().getOrDefault(id,List.of()).stream().anyMatch(f->f.name().equals(row.name())
                    && f.nutrition().equals(row.nutrition()))) return true;
        }
        return false;
    }
}
