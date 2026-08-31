package com.studiobs.spring_backend.domain.brew.dto;

import java.time.LocalDateTime;
import java.util.UUID;

public record PosDeviceResponse(
        UUID id,
        String deviceId,
        String enrolledByNickname,
        LocalDateTime createdAt
) {
}
