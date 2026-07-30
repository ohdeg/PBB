package com.studiobs.spring_backend.domain.dieta.dto;

import com.studiobs.spring_backend.domain.dieta.entity.DietaKetoEvent;
import java.time.LocalDateTime;
import java.util.UUID;

public record DietaKetoEventResponse(
        UUID id,
        LocalDateTime recordedAt,
        boolean easeRequested
) {
    public static DietaKetoEventResponse from(DietaKetoEvent event) {
        return new DietaKetoEventResponse(
                event.getId(),
                event.getRecordedAt(),
                event.isEaseRequested()
        );
    }
}
