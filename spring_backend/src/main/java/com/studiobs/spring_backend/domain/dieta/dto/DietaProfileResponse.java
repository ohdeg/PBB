package com.studiobs.spring_backend.domain.dieta.dto;

import com.studiobs.spring_backend.domain.dieta.entity.DietaProfile;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

public record DietaProfileResponse(
        UUID userId,
        BigDecimal heightCm,
        String goalType,
        String lastNonMaintainGoalType,
        BigDecimal weeklyTargetKg,
        BigDecimal targetWeightKg,
        BigDecimal weeklyBodyFatLossKg,
        BigDecimal weeklyMuscleGainKg,
        String intensityPreference,
        int bmrKcal,
        String bmrSource,
        BigDecimal activityFactor,
        int tdeeKcal,
        String dietStyle,
        DietaMacroPercentsDto macros,
        boolean macrosCustomized,
        String dietBaselineMethod,
        int lossInitialDeficitKcal,
        int gainInitialSurplusKcal,
        int lossCutKcal,
        int lossRecoverKcal,
        int lossActivityKcal,
        int gainSurplusKcal,
        int gainCutKcal,
        int gainCeilingDeltaKcal,
        boolean geminiMealConsent,
        boolean onboardingComplete,
        int dailyKcal,
        LocalDate weekStartsOn,
        int weekActivityExtraKcal,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
    public static DietaProfileResponse from(DietaProfile p, DietaMacroPercentsDto macros) {
        return new DietaProfileResponse(
                p.getUserId(),
                p.getHeightCm(),
                p.getGoalType(),
                p.getLastNonMaintainGoalType(),
                p.getWeeklyTargetKg(),
                p.getTargetWeightKg(),
                p.getWeeklyBodyFatLossKg(),
                p.getWeeklyMuscleGainKg(),
                p.getIntensityPreference(),
                p.getBmrKcal(),
                p.getBmrSource(),
                p.getActivityFactor(),
                p.getTdeeKcal(),
                p.getDietStyle(),
                macros,
                p.isMacrosCustomized(),
                p.getDietBaselineMethod(),
                p.getLossInitialDeficitKcal(),
                p.getGainInitialSurplusKcal(),
                p.getLossCutKcal(),
                p.getLossRecoverKcal(),
                p.getLossActivityKcal(),
                p.getGainSurplusKcal(),
                p.getGainCutKcal(),
                p.getGainCeilingDeltaKcal(),
                p.isGeminiMealConsent(),
                p.isOnboardingComplete(),
                p.getDailyKcal(),
                p.getWeekStartsOn(),
                p.getWeekActivityExtraKcal(),
                p.getCreatedAt(),
                p.getUpdatedAt()
        );
    }
}
