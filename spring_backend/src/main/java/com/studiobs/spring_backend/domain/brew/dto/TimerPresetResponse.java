package com.studiobs.spring_backend.domain.brew.dto;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public record TimerPresetResponse(
        UUID id,
        String scope,
        UUID userId,
        UUID storeId,
        UUID createdByUserId,
        String name,
        List<TimerPresetStepResponse> steps,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
