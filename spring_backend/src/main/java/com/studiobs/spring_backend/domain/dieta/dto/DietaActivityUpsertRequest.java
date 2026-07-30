package com.studiobs.spring_backend.domain.dieta.dto;

import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;

public record DietaActivityUpsertRequest(
        @NotNull LocalDate loggedOn,
        Integer steps,
        Integer durationMin,
        Integer activityKcal,
        String note
) {
}
