package com.studiobs.spring_backend.domain.dieta.service;

import com.studiobs.spring_backend.domain.dieta.dto.DietaWorkout;
import java.util.List;
import java.util.UUID;

record DietaWorkoutTotals(Integer minutes, Integer kcal) {
    static DietaWorkoutTotals of(List<DietaWorkout> workouts) {
        var ids=new java.util.HashSet<UUID>();
        var copied=new java.util.HashSet<UUID>();
        long minutesSum=0, kcalSum=0;
        boolean hasMinutes=false, hasKcal=false;
        for (var row : workouts) {
            if (row==null || row.id()==null || !ids.add(row.id()) || row.name()==null || row.name().isBlank()
                    || row.name().length()>100 || !("direct".equals(row.source()) || "copied".equals(row.source()))
                    || row.durationMin()!=null && row.durationMin()<0 || row.exerciseKcal()!=null && row.exerciseKcal()<0)
                throw DietaEntryStore.invalid("운동 이름과 기록 값을 확인해 주세요.");
            if ("copied".equals(row.source()) ? row.sourceId()==null || !copied.add(row.sourceId())
                    : row.sourceId()!=null) throw DietaEntryStore.invalid("복사한 운동을 확인해 주세요.");
            if (row.durationMin()!=null) { hasMinutes=true; minutesSum+=row.durationMin(); }
            if (row.exerciseKcal()!=null) { hasKcal=true; kcalSum+=row.exerciseKcal(); }
        }
        if (minutesSum>Integer.MAX_VALUE || kcalSum>Integer.MAX_VALUE) throw DietaEntryStore.invalid("운동 합계가 너무 커요.");
        return new DietaWorkoutTotals(hasMinutes ? (int)minutesSum : null, hasKcal ? (int)kcalSum : null);
    }
}
