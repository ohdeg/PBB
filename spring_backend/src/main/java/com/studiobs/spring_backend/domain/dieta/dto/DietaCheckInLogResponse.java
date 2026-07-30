package com.studiobs.spring_backend.domain.dieta.dto;

import com.studiobs.spring_backend.domain.dieta.entity.DietaCheckInLog;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

public record DietaCheckInLogResponse(
        UUID id,
        LocalDate loggedOn,
        BigDecimal weightKg,
        BigDecimal baselineWeightKg,
        BigDecimal weightDeltaKg,
        boolean keepTargets,
        int appliedDailyKcal,
        int appliedActivityExtraKcal,
        BigDecimal appliedWeeklyTargetKg,
        LocalDateTime createdAt
) {
    public static DietaCheckInLogResponse from(DietaCheckInLog log) {
        return new DietaCheckInLogResponse(
                log.getId(),
                log.getLoggedOn(),
                log.getWeightKg(),
                log.getBaselineWeightKg(),
                log.getWeightDeltaKg(),
                log.isKeepTargets(),
                log.getAppliedDailyKcal(),
                log.getAppliedActivityExtraKcal(),
                log.getAppliedWeeklyTargetKg(),
                log.getCreatedAt());
    }
}
