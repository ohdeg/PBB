package com.studiobs.spring_backend.domain.dieta.dto.meal;

import java.time.Instant;

public record DietaMealQueueItemDto(
        String id,
        String mealType,
        String text,
        Instant addedAt
) {
}
