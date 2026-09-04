package com.studiobs.spring_backend.domain.brew.dto;

import java.time.Instant;
import java.util.List;

/** ponytail: poll DTO == future WS payload */
public record StockCheckResponse(
        String requestId,
        Instant updatedAt,
        List<StockCheckItemResponse> items
) {
}
