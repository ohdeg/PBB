package com.studiobs.spring_backend.domain.dieta.dto;

import com.studiobs.spring_backend.domain.dieta.entity.DietaIntakeLog;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

public record DietaIntakeLogResponse(
        UUID id,
        LocalDate loggedOn,
        BigDecimal carbG,
        BigDecimal proteinG,
        BigDecimal fatG,
        int kcal,
        String review,
        String sourceMealsJson
) {
    public static DietaIntakeLogResponse from(DietaIntakeLog log) {
        return new DietaIntakeLogResponse(
                log.getId(),
                log.getLoggedOn(),
                log.getCarbG(),
                log.getProteinG(),
                log.getFatG(),
                log.getKcal(),
                log.getReview(),
                log.getSourceMealsJson());
    }
}
