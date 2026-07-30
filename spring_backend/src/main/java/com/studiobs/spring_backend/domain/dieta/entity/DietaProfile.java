package com.studiobs.spring_backend.domain.dieta.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "dieta_profiles")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class DietaProfile {

    @Id
    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(name = "user_id", length = 36, nullable = false)
    private UUID userId;

    @Column(name = "height_cm", nullable = false, precision = 5, scale = 1)
    private BigDecimal heightCm;

    @Column(name = "goal_type", nullable = false, length = 16)
    private String goalType;

    @Column(name = "last_non_maintain_goal_type", nullable = false, length = 16)
    private String lastNonMaintainGoalType;

    @Column(name = "weekly_target_kg", nullable = false, precision = 4, scale = 2)
    private BigDecimal weeklyTargetKg;

    @Column(name = "target_weight_kg", precision = 5, scale = 2)
    private BigDecimal targetWeightKg;

    @Column(name = "weekly_effective_kg", precision = 4, scale = 2)
    private BigDecimal weeklyEffectiveKg;

    @Column(name = "weekly_body_fat_loss_kg", precision = 4, scale = 2)
    private BigDecimal weeklyBodyFatLossKg;

    @Column(name = "weekly_muscle_gain_kg", precision = 4, scale = 2)
    private BigDecimal weeklyMuscleGainKg;

    @Column(name = "intensity_preference", length = 16)
    private String intensityPreference;

    @Column(name = "bmr_kcal", nullable = false)
    private int bmrKcal;

    @Column(name = "bmr_source", nullable = false, length = 16)
    private String bmrSource;

    @Column(name = "activity_factor", nullable = false, precision = 4, scale = 2)
    private BigDecimal activityFactor;

    @Column(name = "tdee_kcal", nullable = false)
    private int tdeeKcal;

    @Column(name = "daily_kcal", nullable = false)
    private int dailyKcal;

    @Column(name = "diet_style", nullable = false, length = 16)
    private String dietStyle;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "macros_json", nullable = false, columnDefinition = "json")
    private String macrosJson;

    @Column(name = "macros_customized", nullable = false)
    private boolean macrosCustomized;

    @Column(name = "diet_baseline_method", length = 16)
    private String dietBaselineMethod;

    @Column(name = "loss_initial_deficit_kcal", nullable = false)
    private int lossInitialDeficitKcal;

    @Column(name = "gain_initial_surplus_kcal", nullable = false)
    private int gainInitialSurplusKcal;

    @Column(name = "loss_cut_kcal", nullable = false)
    private int lossCutKcal;

    @Column(name = "loss_recover_kcal", nullable = false)
    private int lossRecoverKcal;

    @Column(name = "loss_activity_kcal", nullable = false)
    private int lossActivityKcal;

    @Column(name = "gain_surplus_kcal", nullable = false)
    private int gainSurplusKcal;

    @Column(name = "gain_cut_kcal", nullable = false)
    private int gainCutKcal;

    @Column(name = "gain_ceiling_delta_kcal", nullable = false)
    private int gainCeilingDeltaKcal;

    @Column(name = "gemini_meal_consent", nullable = false)
    private boolean geminiMealConsent;

    @Column(name = "week_starts_on", nullable = false)
    private LocalDate weekStartsOn;

    @Column(name = "week_activity_extra_kcal", nullable = false)
    private int weekActivityExtraKcal;

    @Column(name = "onboarding_complete", nullable = false)
    private boolean onboardingComplete;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @Builder
    public DietaProfile(
            UUID userId,
            BigDecimal heightCm,
            String goalType,
            String lastNonMaintainGoalType,
            BigDecimal weeklyTargetKg,
            BigDecimal targetWeightKg,
            BigDecimal weeklyEffectiveKg,
            BigDecimal weeklyBodyFatLossKg,
            BigDecimal weeklyMuscleGainKg,
            String intensityPreference,
            int bmrKcal,
            String bmrSource,
            BigDecimal activityFactor,
            int tdeeKcal,
            int dailyKcal,
            String dietStyle,
            String macrosJson,
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
            LocalDate weekStartsOn,
            int weekActivityExtraKcal,
            boolean onboardingComplete
    ) {
        this.userId = userId;
        this.heightCm = heightCm;
        this.goalType = goalType;
        this.lastNonMaintainGoalType = lastNonMaintainGoalType;
        this.weeklyTargetKg = weeklyTargetKg;
        this.targetWeightKg = targetWeightKg;
        this.weeklyEffectiveKg = weeklyEffectiveKg;
        this.weeklyBodyFatLossKg = weeklyBodyFatLossKg;
        this.weeklyMuscleGainKg = weeklyMuscleGainKg;
        this.intensityPreference = intensityPreference;
        this.bmrKcal = bmrKcal;
        this.bmrSource = bmrSource;
        this.activityFactor = activityFactor;
        this.tdeeKcal = tdeeKcal;
        this.dailyKcal = dailyKcal;
        this.dietStyle = dietStyle;
        this.macrosJson = macrosJson;
        this.macrosCustomized = macrosCustomized;
        this.dietBaselineMethod = dietBaselineMethod;
        this.lossInitialDeficitKcal = lossInitialDeficitKcal;
        this.gainInitialSurplusKcal = gainInitialSurplusKcal;
        this.lossCutKcal = lossCutKcal;
        this.lossRecoverKcal = lossRecoverKcal;
        this.lossActivityKcal = lossActivityKcal;
        this.gainSurplusKcal = gainSurplusKcal;
        this.gainCutKcal = gainCutKcal;
        this.gainCeilingDeltaKcal = gainCeilingDeltaKcal;
        this.geminiMealConsent = geminiMealConsent;
        this.weekStartsOn = weekStartsOn;
        this.weekActivityExtraKcal = weekActivityExtraKcal;
        this.onboardingComplete = onboardingComplete;
    }

    public void applyPatch(
            BigDecimal heightCm,
            String goalType,
            String lastNonMaintainGoalType,
            BigDecimal weeklyTargetKg,
            BigDecimal targetWeightKg,
            BigDecimal weeklyEffectiveKg,
            BigDecimal weeklyBodyFatLossKg,
            BigDecimal weeklyMuscleGainKg,
            String intensityPreference,
            Integer bmrKcal,
            String bmrSource,
            BigDecimal activityFactor,
            Integer tdeeKcal,
            Integer dailyKcal,
            String dietStyle,
            String macrosJson,
            Boolean macrosCustomized,
            String dietBaselineMethod,
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
        if (heightCm != null) {
            this.heightCm = heightCm;
        }
        if (goalType != null) {
            this.goalType = goalType;
        }
        if (lastNonMaintainGoalType != null) {
            this.lastNonMaintainGoalType = lastNonMaintainGoalType;
        }
        if (weeklyTargetKg != null) {
            this.weeklyTargetKg = weeklyTargetKg;
        }
        if (targetWeightKg != null) {
            this.targetWeightKg = targetWeightKg;
        }
        if (weeklyEffectiveKg != null) {
            this.weeklyEffectiveKg = weeklyEffectiveKg;
        }
        if (weeklyBodyFatLossKg != null) {
            this.weeklyBodyFatLossKg = weeklyBodyFatLossKg;
        }
        if (weeklyMuscleGainKg != null) {
            this.weeklyMuscleGainKg = weeklyMuscleGainKg;
        }
        if (intensityPreference != null) {
            this.intensityPreference = intensityPreference;
        }
        if (bmrKcal != null) {
            this.bmrKcal = bmrKcal;
        }
        if (bmrSource != null) {
            this.bmrSource = bmrSource;
        }
        if (activityFactor != null) {
            this.activityFactor = activityFactor;
        }
        if (tdeeKcal != null) {
            this.tdeeKcal = tdeeKcal;
        }
        if (dailyKcal != null) {
            this.dailyKcal = dailyKcal;
        }
        if (dietStyle != null) {
            this.dietStyle = dietStyle;
        }
        if (macrosJson != null) {
            this.macrosJson = macrosJson;
        }
        if (macrosCustomized != null) {
            this.macrosCustomized = macrosCustomized;
        }
        if (dietBaselineMethod != null) {
            this.dietBaselineMethod = dietBaselineMethod;
        }
        if (lossInitialDeficitKcal != null) {
            this.lossInitialDeficitKcal = lossInitialDeficitKcal;
        }
        if (gainInitialSurplusKcal != null) {
            this.gainInitialSurplusKcal = gainInitialSurplusKcal;
        }
        if (lossCutKcal != null) {
            this.lossCutKcal = lossCutKcal;
        }
        if (lossRecoverKcal != null) {
            this.lossRecoverKcal = lossRecoverKcal;
        }
        if (lossActivityKcal != null) {
            this.lossActivityKcal = lossActivityKcal;
        }
        if (gainSurplusKcal != null) {
            this.gainSurplusKcal = gainSurplusKcal;
        }
        if (gainCutKcal != null) {
            this.gainCutKcal = gainCutKcal;
        }
        if (gainCeilingDeltaKcal != null) {
            this.gainCeilingDeltaKcal = gainCeilingDeltaKcal;
        }
        if (geminiMealConsent != null) {
            this.geminiMealConsent = geminiMealConsent;
        }
        if (weekStartsOn != null) {
            this.weekStartsOn = weekStartsOn;
        }
        if (weekActivityExtraKcal != null) {
            this.weekActivityExtraKcal = weekActivityExtraKcal;
        }
        if (onboardingComplete != null) {
            this.onboardingComplete = onboardingComplete;
        }
    }

    public void enterMaintainMode(String lastGoal, int tdee) {
        this.lastNonMaintainGoalType = lastGoal;
        this.goalType = "MAINTAIN";
        this.weeklyTargetKg = BigDecimal.ZERO;
        this.weeklyBodyFatLossKg = null;
        this.weeklyMuscleGainKg = null;
        this.weeklyEffectiveKg = null;
        this.dailyKcal = tdee;
        this.tdeeKcal = tdee;
        this.weekActivityExtraKcal = 0;
    }

    /** Check-in confirm: keep daily/W/activity; refresh TDEE + week start only. */
    public void applyCheckInKeepTargets(int proposedTdee, LocalDate newWeekStartsOn) {
        this.tdeeKcal = proposedTdee;
        this.weekStartsOn = newWeekStartsOn;
    }

    /** Check-in confirm: apply weight-based prescription. */
    public void applyCheckInAdjust(
            int proposedTdee,
            int proposedDailyKcal,
            int proposedActivityExtraKcal,
            LocalDate newWeekStartsOn
    ) {
        this.tdeeKcal = proposedTdee;
        this.dailyKcal = proposedDailyKcal;
        this.weekActivityExtraKcal = proposedActivityExtraKcal;
        this.weekStartsOn = newWeekStartsOn;
    }

    public void setWeekStartsOn(LocalDate weekStartsOn) {
        this.weekStartsOn = weekStartsOn;
    }

    public void leaveMaintainMode(
            String restoredGoal,
            BigDecimal weeklyTargetKg,
            BigDecimal weeklyBodyFatLossKg,
            BigDecimal weeklyMuscleGainKg,
            BigDecimal weeklyEffectiveKg,
            int dailyKcal
    ) {
        this.goalType = restoredGoal;
        this.lastNonMaintainGoalType = restoredGoal;
        this.weeklyTargetKg = weeklyTargetKg;
        this.weeklyBodyFatLossKg = weeklyBodyFatLossKg;
        this.weeklyMuscleGainKg = weeklyMuscleGainKg;
        this.weeklyEffectiveKg = weeklyEffectiveKg;
        this.dailyKcal = dailyKcal;
        this.weekActivityExtraKcal = 0;
    }
}
