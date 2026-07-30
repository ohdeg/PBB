package com.studiobs.spring_backend.domain.dieta.dto.meal;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

public record DietaMealQueueDayResponse(
        LocalDate loggedOn,
        String status,
        List<DietaMealQueueItemDto> items,
        Instant updatedAt
) {
    public static DietaMealQueueDayResponse empty(LocalDate loggedOn) {
        return new DietaMealQueueDayResponse(loggedOn, "open", List.of(), Instant.now());
    }
}
