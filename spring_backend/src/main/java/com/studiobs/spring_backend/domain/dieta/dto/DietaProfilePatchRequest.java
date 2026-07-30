package com.studiobs.spring_backend.domain.dieta.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Pattern;
import java.math.BigDecimal;
import java.time.LocalDate;

public record DietaProfilePatchRequest(
        BigDecimal heightCm,
        @Pattern(regexp = "LOSS|GAIN|MAINTAIN") String goalType,
        @Pattern(regexp = "LOSS|GAIN") String lastNonMaintainGoalType,
        BigDecimal weeklyTargetKg,
        BigDecimal targetWeightKg,
        BigDecimal weeklyBodyFatLossKg,
        BigDecimal weeklyMuscleGainKg,
        @Pattern(regexp = "BOOST|HOLD") String intensityPreference,
        Integer bmrKcal,
        @Pattern(regexp = "USER_ENTERED|ESTIMATED") String bmrSource,
        BigDecimal activityFactor,
        Integer tdeeKcal,
        Integer dailyKcal,
        @Pattern(regexp = "BALANCED|TRAINING|KETO|VEGAN") String dietStyle,
        @Valid DietaMacroPercentsDto macros,
        Boolean macrosCustomized,
        @Pattern(regexp = "SURVEY|DIARY_5D") String dietBaselineMethod,
        Integer lossInitialDeficitKcal,
        Integer gainInitialSurplusKcal,
        Integer lossCutKcal,
        Integer lossRecoverKcal,
        Integer lossActivityKcal,
        Integer gainSurplusKcal,
        Integer gainCutKcal,
        Integer gainCeilingDeltaKcal,
        Boolean geminiMealConsent,
        LocalDate weekStartsOn,
        Integer weekActivityExtraKcal,
        Boolean onboardingComplete
) {
}
