package com.studiobs.spring_backend.domain.brew.dto;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

public record SubscriberResponse(
        UUID userId,
        String email,
        String nickname,
        boolean canEditStock,
        LocalDate workStartDate,
        LocalDate leaveDate,
        LocalDateTime createdAt
) {
}
