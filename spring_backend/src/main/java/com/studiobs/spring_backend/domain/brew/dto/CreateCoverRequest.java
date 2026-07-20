package com.studiobs.spring_backend.domain.brew.dto;

import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.UUID;

public record CreateCoverRequest(
        @NotNull UUID originalUserId,
        UUID coverUserId,
        @NotNull LocalDate workDate,
        @NotNull LocalTime startTime,
        @NotNull LocalTime endTime,
        String note
) {
}
