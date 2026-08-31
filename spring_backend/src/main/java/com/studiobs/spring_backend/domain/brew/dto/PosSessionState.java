package com.studiobs.spring_backend.domain.brew.dto;

import java.util.UUID;

public record PosSessionState(
        UUID userId,
        UUID storeId,
        boolean canEditStock,
        String deviceId
) {
}
