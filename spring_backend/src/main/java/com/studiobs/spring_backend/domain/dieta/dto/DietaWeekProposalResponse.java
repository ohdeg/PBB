package com.studiobs.spring_backend.domain.dieta.dto;

import com.studiobs.spring_backend.domain.dieta.support.DietaMath;
import java.math.BigDecimal;
import java.time.LocalDate;

public record DietaWeekProposalResponse(
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
        String summary,
        BigDecimal baselineWeightKg,
        BigDecimal checkInWeightKg,
        LocalDate weekStartsOn,
        boolean due,
        boolean targetWeightReached
) {
    public static DietaWeekProposalResponse from(
            DietaMath.WeekProposal proposal,
            BigDecimal baselineWeightKg,
            BigDecimal checkInWeightKg,
            LocalDate weekStartsOn,
            boolean due,
            boolean targetWeightReached
    ) {
        return new DietaWeekProposalResponse(
                proposal.eval(),
                proposal.x(),
                proposal.source(),
                proposal.avgIntakeKcal(),
                proposal.intakeDays(),
                proposal.weightDeltaKg(),
                proposal.fatDeltaKg(),
                proposal.muscleDeltaKg(),
                proposal.proposedTdee(),
                proposal.proposedDailyKcal(),
                proposal.proposedActivityExtraKcal(),
                proposal.action(),
                proposal.summary(),
                baselineWeightKg,
                checkInWeightKg,
                weekStartsOn,
                due,
                targetWeightReached);
    }
}
