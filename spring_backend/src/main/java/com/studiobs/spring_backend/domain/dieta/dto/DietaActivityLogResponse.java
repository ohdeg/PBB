package com.studiobs.spring_backend.domain.dieta.dto;

import com.studiobs.spring_backend.domain.dieta.entity.DietaActivityLog;
import java.time.LocalDate;
import java.util.UUID;

public record DietaActivityLogResponse(
        UUID id,
        LocalDate loggedOn,
        Integer steps,
        Integer durationMin,
        Integer activityKcal,
        boolean splitCalories,
        Integer walkingKcal,
        Integer exerciseKcal,
        String note, String activityName, java.util.Set<String> estimatedFields, String revision, java.util.List<DietaWorkout> workouts
) {
    public DietaActivityLogResponse(UUID id, LocalDate day, Integer steps, Integer minutes, Integer kcal,
            boolean split, Integer walking, Integer exercise, String note, String name, java.util.Set<String> fields, String revision) {
        this(id,day,steps,minutes,kcal,split,walking,exercise,note,name,fields,revision,null);
    }

    @com.fasterxml.jackson.annotation.JsonProperty
    public long missingExerciseKcal() {
        return workouts == null ? 0 : workouts.stream().filter(w -> w.exerciseKcal() == null).count();
    }

    @com.fasterxml.jackson.annotation.JsonProperty
    public long missingDurationMin() {
        return workouts == null ? 0 : workouts.stream().filter(w -> w.durationMin() == null).count();
    }

    public static DietaActivityLogResponse from(DietaActivityLog log) {
        return new DietaActivityLogResponse(
                log.getId(),
                log.getLoggedOn(),
                log.getSteps(),
                log.getDurationMin(),
                log.getActivityKcal(),
                log.isSplitCalories(),
                log.getWalkingKcal(),
                log.getExerciseKcal(),
                log.getNote(), null, java.util.Set.of(), null
        );
    }
}
