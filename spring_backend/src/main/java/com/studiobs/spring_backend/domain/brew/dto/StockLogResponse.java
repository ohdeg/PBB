package com.studiobs.spring_backend.domain.brew.dto;

import java.time.LocalDateTime;

public record StockLogResponse(
        Integer id,
        int fromNum,
        int toNum,
        String nickname,
        LocalDateTime createdAt
) {
}
