package com.studiobs.spring_backend.domain.dieta.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import java.time.LocalDate;

public record DietaActivityUpsertRequest(
        @NotNull LocalDate loggedOn,
        @PositiveOrZero Integer steps,
        @PositiveOrZero Integer durationMin,
        @PositiveOrZero Integer activityKcal,
        Boolean splitCalories,
        @PositiveOrZero Integer exerciseKcal,
        @PositiveOrZero Integer expectedLegacyKcal,
        String note, @jakarta.validation.constraints.Size(max=100) String activityName,
        java.util.Set<String> estimatedFields, String revision, String suggestionRevision, String deviceZone, java.util.List<DietaWorkout> workouts
) {
}
