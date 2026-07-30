package com.studiobs.spring_backend.domain.dieta.dto;

import com.studiobs.spring_backend.domain.dieta.entity.DietaBodyLog;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

public record DietaBodyLogResponse(
        UUID id,
        LocalDate loggedOn,
        BigDecimal weightKg,
        BigDecimal bodyFatMassKg,
        BigDecimal skeletalMuscleMassKg,
        boolean fasted,
        String source
) {
    public static DietaBodyLogResponse from(DietaBodyLog log) {
        return new DietaBodyLogResponse(
                log.getId(),
                log.getLoggedOn(),
                log.getWeightKg(),
                log.getBodyFatMassKg(),
                log.getSkeletalMuscleMassKg(),
                log.isFasted(),
                log.getSource()
        );
    }
}
