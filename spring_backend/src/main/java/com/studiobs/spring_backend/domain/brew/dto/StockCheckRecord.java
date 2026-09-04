package com.studiobs.spring_backend.domain.brew.dto;

import java.time.Instant;
import java.util.List;

public record StockCheckRecord(
        String requestId,
        List<Integer> stockIds,
        Instant requestedAt,
        Instant updatedAt,
        String requestedByUserId
) {
}
