package com.studiobs.spring_backend.domain.dieta.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import java.math.BigDecimal;

public record DietaOnboardingRequest(
        @NotNull @DecimalMin("50") BigDecimal heightCm,
        @NotNull @DecimalMin("20") BigDecimal weightKg,
        BigDecimal bodyFatMassKg,
        BigDecimal skeletalMuscleMassKg,
        @NotNull @Min(10) @Max(120) Integer ageYears,
        @NotBlank @Pattern(regexp = "M|F") String sex,
        @NotBlank @Pattern(regexp = "LOSS|GAIN|MAINTAIN") String goalType,
        @NotNull @DecimalMin("0") BigDecimal weeklyTargetKg,
        BigDecimal targetWeightKg,
        BigDecimal weeklyBodyFatLossKg,
        BigDecimal weeklyMuscleGainKg,
        @Pattern(regexp = "BOOST|HOLD") String intensityPreference,
        Integer bmrKcal,
        @NotNull @DecimalMin("1.0") BigDecimal activityFactor,
        @NotBlank @Pattern(regexp = "BALANCED|TRAINING|KETO|VEGAN") String dietStyle,
        @NotNull @Valid DietaMacroPercentsDto macros,
        boolean macrosCustomized,
        @NotNull Integer lossInitialDeficitKcal,
        @NotNull Integer gainInitialSurplusKcal,
        @NotNull Integer lossCutKcal,
        @NotNull Integer lossRecoverKcal,
        @NotNull Integer lossActivityKcal,
        @NotNull Integer gainSurplusKcal,
        @NotNull Integer gainCutKcal,
        @NotNull Integer gainCeilingDeltaKcal,
        boolean geminiMealConsent
) {
}
