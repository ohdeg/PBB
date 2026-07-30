package com.studiobs.spring_backend.domain.dieta.support;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;

class DietaMathTest {

    @Test
    void estimateBmr_and_tdee() {
        int bmr = DietaMath.estimateBmrKcal(
                new BigDecimal("80"), new BigDecimal("175"), 30, "M");
        assertThat(bmr).isGreaterThan(1600);
        assertThat(DietaMath.computeTdee(bmr, new BigDecimal("1.4")))
                .isGreaterThanOrEqualTo(bmr);
    }

    @Test
    void computeTdee_usesConservativeActivityFactor() {
        assertThat(DietaMath.conservativeActivityFactor(1.2))
                .isCloseTo(1.2, org.assertj.core.data.Offset.offset(1e-9));
        assertThat(DietaMath.conservativeActivityFactor(1.4))
                .isCloseTo(1.3, org.assertj.core.data.Offset.offset(1e-9));
        assertThat(DietaMath.conservativeActivityFactor(1.725))
                .isCloseTo(1.54375, org.assertj.core.data.Offset.offset(1e-9));
        assertThat(DietaMath.computeTdee(2000, new BigDecimal("1.4"))).isEqualTo(2600);
        assertThat(DietaMath.computeTdee(2000, new BigDecimal("1.725"))).isEqualTo(3088);
    }

    @Test
    void weeklyX_isWeightDeltaOver1_2() {
        assertThat(DietaMath.computeWeeklyXFromWeight("LOSS", new BigDecimal("-1.2")))
                .isEqualTo(1.0);
        assertThat(DietaMath.computeWeeklyXFromWeight("GAIN", new BigDecimal("1.2")))
                .isEqualTo(1.0);
        assertThat(DietaMath.computeWeeklyXFromWeight("MAINTAIN", new BigDecimal("1.0")))
                .isNull();
    }

    @Test
    void lossDaily_floorsAtBmr() {
        assertThat(DietaMath.applyLossDaily(1200, 1500)).isEqualTo(1500);
    }

    @Test
    void evaluateWeeklyX_bands() {
        BigDecimal w = new BigDecimal("0.5");
        assertThat(DietaMath.evaluateWeeklyX(0.2, w)).isEqualTo("PLATEAU");
        assertThat(DietaMath.evaluateWeeklyX(0.5, w)).isEqualTo("ON_TRACK");
        assertThat(DietaMath.evaluateWeeklyX(0.8, w)).isEqualTo("TOO_FAST");
    }

    @Test
    void estimateTdeeFromWeightBalance() {
        // Δweight=-1.2 → effective=-1 → est = 2000 + 7700/7 ≈ 3100
        DietaMath.TdeeEstimate est = DietaMath.estimateTdeeFromIntake(
                2000, null, new BigDecimal("-1.2"), 1500);
        assertThat(est.source()).isEqualTo("INTAKE_WEIGHT_BALANCE");
        assertThat(est.tdee()).isEqualTo(3100);
    }

    @Test
    void lossPlateau_prefersCutWhenAboveBmr() {
        DietaMath.WeekProposal p = DietaMath.buildWeeklyCheckInProposal(baseLossInput(
                new BigDecimal("-0.1"), "CUT_KCAL"));
        assertThat(p.eval()).isEqualTo("PLATEAU");
        assertThat(p.action()).isEqualTo("CUT_KCAL");
        assertThat(p.proposedDailyKcal()).isLessThan(2000);
        assertThat(p.proposedActivityExtraKcal()).isZero();
    }

    @Test
    void lossPlateau_usesActivityWhenChosen() {
        DietaMath.WeekProposal p = DietaMath.buildWeeklyCheckInProposal(baseLossInput(
                new BigDecimal("-0.1"), "ADD_ACTIVITY"));
        assertThat(p.action()).isEqualTo("ADD_ACTIVITY");
        assertThat(p.proposedDailyKcal()).isEqualTo(2000);
        assertThat(p.proposedActivityExtraKcal()).isEqualTo(150);
    }

    @Test
    void lossTooFast_recovers() {
        DietaMath.WeekProposal p = DietaMath.buildWeeklyCheckInProposal(baseLossInput(
                new BigDecimal("-1.2"), "CUT_KCAL"));
        assertThat(p.eval()).isEqualTo("TOO_FAST");
        assertThat(p.action()).isEqualTo("RECOVER");
        assertThat(p.proposedDailyKcal()).isEqualTo(2150);
    }

    @Test
    void gainPlateau_surplus() {
        DietaMath.WeekProposalInput in = new DietaMath.WeekProposalInput(
                "GAIN",
                new BigDecimal("0.5"),
                2500,
                2300,
                1600,
                175,
                150,
                150,
                250,
                175,
                500,
                0,
                0,
                new BigDecimal("0.1"),
                null,
                null,
                "CUT_KCAL");
        DietaMath.WeekProposal p = DietaMath.buildWeeklyCheckInProposal(in);
        assertThat(p.eval()).isEqualTo("PLATEAU");
        assertThat(p.action()).isEqualTo("SURPLUS");
        assertThat(p.proposedDailyKcal()).isEqualTo(2750);
    }

    @Test
    void maintain_setsDailyToProposedTdee() {
        DietaMath.WeekProposalInput in = new DietaMath.WeekProposalInput(
                "MAINTAIN",
                BigDecimal.ZERO,
                2200,
                2200,
                1600,
                175,
                150,
                150,
                250,
                175,
                500,
                2100,
                5,
                new BigDecimal("0.2"),
                null,
                null,
                "CUT_KCAL");
        DietaMath.WeekProposal p = DietaMath.buildWeeklyCheckInProposal(in);
        assertThat(p.eval()).isEqualTo("MAINTAIN");
        assertThat(p.action()).isEqualTo("HOLD");
        assertThat(p.proposedDailyKcal()).isEqualTo(p.proposedTdee());
        assertThat(p.x()).isNull();
    }

    @Test
    void hasReachedTargetWeight_lossAndGain() {
        assertThat(DietaMath.hasReachedTargetWeight(
                "LOSS", new BigDecimal("70"), new BigDecimal("70"))).isTrue();
        assertThat(DietaMath.hasReachedTargetWeight(
                "LOSS", new BigDecimal("70.1"), new BigDecimal("70"))).isFalse();
        assertThat(DietaMath.hasReachedTargetWeight(
                "GAIN", new BigDecimal("80"), new BigDecimal("80"))).isTrue();
        assertThat(DietaMath.hasReachedTargetWeight(
                "MAINTAIN", new BigDecimal("70"), new BigDecimal("70"))).isFalse();
    }

    @Test
    void isWeeklyCheckInDue_afterSevenDays() {
        LocalDate start = LocalDate.of(2026, 7, 1);
        assertThat(DietaMath.isWeeklyCheckInDue(start, LocalDate.of(2026, 7, 7))).isFalse();
        assertThat(DietaMath.isWeeklyCheckInDue(start, LocalDate.of(2026, 7, 8))).isTrue();
    }

    private static DietaMath.WeekProposalInput baseLossInput(BigDecimal weightDelta, String plateau) {
        return new DietaMath.WeekProposalInput(
                "LOSS",
                new BigDecimal("0.5"),
                2000,
                2400,
                1600,
                175,
                150,
                150,
                250,
                175,
                500,
                0,
                0,
                weightDelta,
                null,
                null,
                plateau);
    }
}
