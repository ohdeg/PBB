package com.studiobs.spring_backend.domain.brew.dto;

import java.time.Instant;
import java.util.UUID;

public record PosMeResponse(
        UUID storeId,
        boolean canEditStock,
        Instant expiresAt,
        String deviceId
) {
}
