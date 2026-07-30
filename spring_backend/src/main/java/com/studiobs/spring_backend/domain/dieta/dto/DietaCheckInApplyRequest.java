package com.studiobs.spring_backend.domain.dieta.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import java.math.BigDecimal;
import java.time.LocalDate;

public record DietaCheckInApplyRequest(
        @NotNull LocalDate loggedOn,
        @NotNull @DecimalMin("0.1") BigDecimal weightKg,
        boolean keepTargets,
        @Pattern(regexp = "CUT_KCAL|ADD_ACTIVITY") String plateauChoice,
        @Min(0) Integer avgIntakeKcal,
        @Min(0) Integer intakeDays
) {
}
