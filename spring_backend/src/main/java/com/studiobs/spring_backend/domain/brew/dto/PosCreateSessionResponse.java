package com.studiobs.spring_backend.domain.brew.dto;

import java.time.Instant;
import java.util.UUID;

public record PosCreateSessionResponse(
        UUID pairId,
        String secret,
        String payload,
        Instant expiresAt,
        UUID storeId
) {
}
