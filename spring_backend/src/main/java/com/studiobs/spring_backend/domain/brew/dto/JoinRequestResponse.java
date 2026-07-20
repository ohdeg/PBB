package com.studiobs.spring_backend.domain.brew.dto;

import java.util.UUID;

public record JoinRequestResponse(
        UUID userId,
        String email,
        String nickname
) {
}
