package com.studiobs.spring_backend.domain.dieta.support;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;

/** Mirrors FE `dietaMath` helpers (onboarding, maintain-mode, weekly check-in). */
public final class DietaMath {

    private static final BigDecimal DEFAULT_WEEKLY_TARGET_KG = new BigDecimal("0.5");
    private static final BigDecimal WEIGHT_X_DIVISOR = new BigDecimal("1.2");
    private static final int KCAL_PER_KG = 7700;
    /** Discount applied to (activityFactor − 1) when computing TDEE so maintain kcal is not overstated. */
    private static final double ACTIVITY_FACTOR_CONSERVATIVE_SCALE = 0.75;
    private static final double MIN_TDEE_ACTIVITY_FACTOR = 1.2;

    private DietaMath() {
    }

    public static int estimateBmrKcal(BigDecimal weightKg, BigDecimal heightCm, int ageYears, String sex) {
        double base = 10 * weightKg.doubleValue()
                + 6.25 * heightCm.doubleValue()
                - 5 * ageYears;
        return (int) Math.round("F".equalsIgnoreCase(sex) ? base - 161 : base + 5);
    }

    /**
     * Conservative TDEE activity factor: {@code 1 + (factor − 1) × 0.75}, floored at 1.2.
     * UI still stores/shows the raw survey factor; only TDEE uses this.
     */
    public static double conservativeActivityFactor(double activityFactor) {
        double scaled = 1.0 + (activityFactor - 1.0) * ACTIVITY_FACTOR_CONSERVATIVE_SCALE;
        return Math.max(scaled, MIN_TDEE_ACTIVITY_FACTOR);
    }

    public static int computeTdee(int bmr, BigDecimal activityFactor) {
        double factor = conservativeActivityFactor(activityFactor.doubleValue());
        return Math.max((int) Math.round(bmr * factor), bmr);
    }

    /** Macros → kcal (carb×4 + protein×4 + fat×9). */
    public static int kcalFromMacros(double carbG, double proteinG, double fatG) {
        return (int) Math.round(carbG * 4 + proteinG * 4 + fatG * 9);
    }

    public static int applyLossDaily(int daily, int bmr) {
        return Math.max(daily, bmr);
    }

    public static int applyGainDaily(int daily, int tdee, int ceilingDelta) {
        return Math.min(daily, tdee + ceilingDelta);
    }

    public static BigDecimal deriveWeeklyEffective(BigDecimal weeklyTargetKg) {
        if (weeklyTargetKg == null || weeklyTargetKg.compareTo(BigDecimal.ZERO) <= 0) {
            return null;
        }
        return weeklyTargetKg.multiply(new BigDecimal("0.9")).setScale(3, RoundingMode.HALF_UP);
    }

    public static BigDecimal resolveWeeklyTarget(BigDecimal current) {
        if (current != null && current.compareTo(BigDecimal.ZERO) > 0) {
            return current;
        }
        return DEFAULT_WEEKLY_TARGET_KG;
    }

    /** Weight-only weekly X: signed delta / 1.2 (product rule). */
    public static Double computeWeeklyXFromWeight(String goalType, BigDecimal weightDeltaKg) {
        if (weightDeltaKg == null || "MAINTAIN".equals(goalType)) {
            return null;
        }
        double raw = "LOSS".equals(goalType)
                ? -weightDeltaKg.doubleValue()
                : weightDeltaKg.doubleValue();
        return raw / 1.2;
    }

    /**
     * Weekly coaching X: body-fat delta preferred; else weight/1.2.
     * Positive X = progress in goal direction.
     */
    public static WeeklyX computeWeeklyX(String goalType, BigDecimal fatDeltaKg, BigDecimal weightDeltaKg) {
        if ("MAINTAIN".equals(goalType)) {
            return new WeeklyX(null, null);
        }
        if (fatDeltaKg != null) {
            double x = "LOSS".equals(goalType) ? -fatDeltaKg.doubleValue() : fatDeltaKg.doubleValue();
            return new WeeklyX(x, "FAT");
        }
        if (weightDeltaKg != null) {
            Double x = computeWeeklyXFromWeight(goalType, weightDeltaKg);
            return new WeeklyX(x, "WEIGHT");
        }
        return new WeeklyX(null, null);
    }

    public static String evaluateWeeklyX(double x, BigDecimal weeklyTargetKg) {
        double w = Math.max(
                weeklyTargetKg != null ? weeklyTargetKg.doubleValue() : 0.01,
                0.01);
        if (x < 0.75 * w) {
            return "PLATEAU";
        }
        if (x > 1.25 * w) {
            return "TOO_FAST";
        }
        return "ON_TRACK";
    }

    public static TdeeEstimate estimateTdeeFromIntake(
            int avgIntakeKcal,
            BigDecimal fatDeltaKg,
            BigDecimal weightDeltaKg,
            int bmr
    ) {
        if (fatDeltaKg != null) {
            double est = avgIntakeKcal + (-fatDeltaKg.doubleValue() * KCAL_PER_KG) / 7.0;
            return new TdeeEstimate(Math.max((int) Math.round(est), bmr), "INTAKE_FAT_BALANCE");
        }
        double w = weightDeltaKg != null ? weightDeltaKg.doubleValue() : 0;
        double effective = w / WEIGHT_X_DIVISOR.doubleValue();
        double est = avgIntakeKcal + (-effective * KCAL_PER_KG) / 7.0;
        return new TdeeEstimate(Math.max((int) Math.round(est), bmr), "INTAKE_WEIGHT_BALANCE");
    }

    public static long daysBetween(LocalDate start, LocalDate end) {
        return ChronoUnit.DAYS.between(start, end);
    }

    public static boolean isWeeklyCheckInDue(LocalDate weekStartsOn, LocalDate today) {
        return weekStartsOn != null && daysBetween(weekStartsOn, today) >= 7;
    }

    public static boolean hasReachedTargetWeight(
            String goalType,
            BigDecimal weightKg,
            BigDecimal targetWeightKg
    ) {
        if (targetWeightKg == null || weightKg == null) {
            return false;
        }
        if (targetWeightKg.compareTo(BigDecimal.ZERO) <= 0 || weightKg.compareTo(BigDecimal.ZERO) <= 0) {
            return false;
        }
        if ("LOSS".equals(goalType)) {
            return weightKg.compareTo(targetWeightKg) <= 0;
        }
        if ("GAIN".equals(goalType)) {
            return weightKg.compareTo(targetWeightKg) >= 0;
        }
        return false;
    }

    public static WeekProposal buildWeeklyCheckInProposal(WeekProposalInput in) {
        int intakeForTdee = in.intakeDays() > 0 ? in.avgIntakeKcal() : in.currentDailyKcal();
        TdeeEstimate tdeeEst = estimateTdeeFromIntake(
                intakeForTdee,
                in.fatDeltaKg(),
                in.weightDeltaKg(),
                in.bmr());
        int proposedTdee = tdeeEst.tdee();

        if ("MAINTAIN".equals(in.goalType())) {
            return new WeekProposal(
                    "MAINTAIN",
                    null,
                    null,
                    in.avgIntakeKcal(),
                    in.intakeDays(),
                    in.weightDeltaKg(),
                    in.fatDeltaKg(),
                    in.muscleDeltaKg(),
                    proposedTdee,
                    proposedTdee,
                    0,
                    "HOLD",
                    "유지: 다음 주 일일 목표를 추정 TDEE에 맞춥니다.");
        }

        Double x = null;
        String source = null;
        if ("GAIN".equals(in.goalType()) && in.muscleDeltaKg() != null) {
            x = in.muscleDeltaKg().doubleValue();
            source = "MUSCLE";
        } else {
            WeeklyX computed = computeWeeklyX(in.goalType(), in.fatDeltaKg(), in.weightDeltaKg());
            x = computed.x();
            source = computed.source();
        }

        if (x == null) {
            return new WeekProposal(
                    "ON_TRACK",
                    null,
                    null,
                    in.avgIntakeKcal(),
                    in.intakeDays(),
                    in.weightDeltaKg(),
                    in.fatDeltaKg(),
                    in.muscleDeltaKg(),
                    proposedTdee,
                    in.currentDailyKcal(),
                    0,
                    "HOLD",
                    "변화량을 계산할 수 없어 이번 주 목표를 유지합니다.");
        }

        String band = evaluateWeeklyX(x, in.weeklyTargetKg());

        if ("LOSS".equals(in.goalType())) {
            if ("PLATEAU".equals(band)) {
                boolean canCut = in.currentDailyKcal() - in.lossCutKcal() >= in.bmr();
                boolean useActivity = "ADD_ACTIVITY".equals(in.plateauChoice()) || !canCut;
                if (useActivity) {
                    return new WeekProposal(
                            band,
                            x,
                            source,
                            in.avgIntakeKcal(),
                            in.intakeDays(),
                            in.weightDeltaKg(),
                            in.fatDeltaKg(),
                            in.muscleDeltaKg(),
                            proposedTdee,
                            in.currentDailyKcal(),
                            in.lossActivityKcal(),
                            "ADD_ACTIVITY",
                            "정체: 식사량은 유지하고 활동 +" + in.lossActivityKcal() + "kcal를 제안합니다.");
                }
                int daily = applyLossDaily(in.currentDailyKcal() - in.lossCutKcal(), in.bmr());
                return new WeekProposal(
                        band,
                        x,
                        source,
                        in.avgIntakeKcal(),
                        in.intakeDays(),
                        in.weightDeltaKg(),
                        in.fatDeltaKg(),
                        in.muscleDeltaKg(),
                        proposedTdee,
                        daily,
                        0,
                        "CUT_KCAL",
                        "정체: 식사 −" + in.lossCutKcal() + "kcal → 일일 " + daily + "kcal를 제안합니다.");
            }
            if ("TOO_FAST".equals(band)) {
                int daily = applyLossDaily(in.currentDailyKcal() + in.lossRecoverKcal(), in.bmr());
                return new WeekProposal(
                        band,
                        x,
                        source,
                        in.avgIntakeKcal(),
                        in.intakeDays(),
                        in.weightDeltaKg(),
                        in.fatDeltaKg(),
                        in.muscleDeltaKg(),
                        proposedTdee,
                        daily,
                        0,
                        "RECOVER",
                        "과속: 식사 +" + in.lossRecoverKcal() + "kcal → 일일 " + daily + "kcal를 제안합니다.");
            }
            return holdProposal(band, x, source, in, proposedTdee);
        }

        // GAIN
        if ("PLATEAU".equals(band)) {
            int daily = applyGainDaily(
                    in.currentDailyKcal() + in.gainSurplusKcal(),
                    proposedTdee,
                    in.gainCeilingDeltaKcal());
            return new WeekProposal(
                    band,
                    x,
                    source,
                    in.avgIntakeKcal(),
                    in.intakeDays(),
                    in.weightDeltaKg(),
                    in.fatDeltaKg(),
                    in.muscleDeltaKg(),
                    proposedTdee,
                    daily,
                    0,
                    "SURPLUS",
                    "정체: 식사 +" + in.gainSurplusKcal() + "kcal → 일일 " + daily + "kcal를 제안합니다.");
        }
        if ("TOO_FAST".equals(band)) {
            int daily = applyGainDaily(
                    in.currentDailyKcal() - in.gainCutKcal(),
                    proposedTdee,
                    in.gainCeilingDeltaKcal());
            return new WeekProposal(
                    band,
                    x,
                    source,
                    in.avgIntakeKcal(),
                    in.intakeDays(),
                    in.weightDeltaKg(),
                    in.fatDeltaKg(),
                    in.muscleDeltaKg(),
                    proposedTdee,
                    daily,
                    0,
                    "CUT_GAIN",
                    "과속: 식사 −" + in.gainCutKcal() + "kcal → 일일 " + daily + "kcal를 제안합니다.");
        }
        return holdProposal(band, x, source, in, proposedTdee);
    }

    private static WeekProposal holdProposal(
            String band,
            Double x,
            String source,
            WeekProposalInput in,
            int proposedTdee
    ) {
        return new WeekProposal(
                band,
                x,
                source,
                in.avgIntakeKcal(),
                in.intakeDays(),
                in.weightDeltaKg(),
                in.fatDeltaKg(),
                in.muscleDeltaKg(),
                proposedTdee,
                in.currentDailyKcal(),
                0,
                "HOLD",
                "순항: 식사·활동 목표를 유지하고 TDEE만 갱신합니다.");
    }

    public record WeeklyX(Double x, String source) {
    }

    public record TdeeEstimate(int tdee, String source) {
    }

    public record WeekProposalInput(
            String goalType,
            BigDecimal weeklyTargetKg,
            int currentDailyKcal,
            int currentTdee,
            int bmr,
            int lossCutKcal,
            int lossRecoverKcal,
            int lossActivityKcal,
            int gainSurplusKcal,
            int gainCutKcal,
            int gainCeilingDeltaKcal,
            int avgIntakeKcal,
            int intakeDays,
            BigDecimal weightDeltaKg,
            BigDecimal fatDeltaKg,
            BigDecimal muscleDeltaKg,
            String plateauChoice
    ) {
    }

    public record WeekProposal(
            String eval,
            Double x,
            String source,
            int avgIntakeKcal,
            int intakeDays,
            BigDecimal weightDeltaKg,
            BigDecimal fatDeltaKg,
            BigDecimal muscleDeltaKg,
            int proposedTdee,
            int proposedDailyKcal,
            int proposedActivityExtraKcal,
            String action,
            String summary
    ) {
    }
}
