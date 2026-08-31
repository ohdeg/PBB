package com.studiobs.spring_backend.domain.brew.dto;

import java.util.UUID;

public record PosPollResponse(
        String status,
        UUID pairId
) {
}
