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
        String note, String activityName, java.util.Set<String> estimatedFields, String revision
) {
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
