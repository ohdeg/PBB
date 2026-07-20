package com.studiobs.spring_backend.domain.brew.dto;

import java.util.UUID;

public record StaffMemberResponse(
        UUID userId,
        String nickname
) {
}
