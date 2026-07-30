package com.studiobs.spring_backend.domain.dieta.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

public record DietaBodyLogUpsertRequest(
        UUID id,
        @NotNull LocalDate loggedOn,
        BigDecimal weightKg,
        BigDecimal bodyFatMassKg,
        BigDecimal skeletalMuscleMassKg,
        boolean fasted,
        @NotBlank @Pattern(regexp = "DAILY_FASTED|ONBOARDING|CHECK_IN|MANUAL") String source
) {
}
