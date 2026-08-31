package com.studiobs.spring_backend.domain.brew.dto;

import java.util.UUID;

public record PosPairState(
        String secret,
        String deviceId,
        UUID storeId,
        String status,
        UUID userId,
        boolean canEditStock
) {
    public static final String PENDING = "pending";
    public static final String APPROVED = "approved";
}
