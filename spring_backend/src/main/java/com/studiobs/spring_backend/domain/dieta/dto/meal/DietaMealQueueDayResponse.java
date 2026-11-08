package com.studiobs.spring_backend.domain.dieta.dto.meal;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

public record DietaMealQueueDayResponse(
        LocalDate loggedOn,
        String status,
        List<DietaMealQueueItemDto> items,
        Instant updatedAt,
        String availableStage, int newItemCount, LocalDate retryableYesterday
) {
    public DietaMealQueueDayResponse(LocalDate day, String status, List<DietaMealQueueItemDto> items, Instant updatedAt) {
        this(day, status, items, updatedAt, null, 0);
    }

    public DietaMealQueueDayResponse(LocalDate day, String status, List<DietaMealQueueItemDto> items,
            Instant updatedAt, String stage, int count) {
        this(day, status, items, updatedAt, stage, count, null);
    }

    public DietaMealQueueDayResponse withRetryableYesterday(LocalDate day) {
        return new DietaMealQueueDayResponse(loggedOn, status, items, updatedAt, availableStage, newItemCount, day);
    }

    public static DietaMealQueueDayResponse empty(LocalDate loggedOn) {
        return new DietaMealQueueDayResponse(loggedOn, "open", List.of(), Instant.now());
    }
}
