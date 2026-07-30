package com.studiobs.spring_backend.domain.dieta.dto;

import com.studiobs.spring_backend.domain.dieta.entity.DietaActivityLog;
import java.time.LocalDate;
import java.util.UUID;

public record DietaActivityLogResponse(
        UUID id,
        LocalDate loggedOn,
        Integer steps,
        Integer durationMin,
        Integer activityKcal,
        String note
) {
    public static DietaActivityLogResponse from(DietaActivityLog log) {
        return new DietaActivityLogResponse(
                log.getId(),
                log.getLoggedOn(),
                log.getSteps(),
                log.getDurationMin(),
                log.getActivityKcal(),
                log.getNote()
        );
    }
}
