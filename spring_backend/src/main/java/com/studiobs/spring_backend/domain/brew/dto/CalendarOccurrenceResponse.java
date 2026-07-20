package com.studiobs.spring_backend.domain.brew.dto;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.UUID;

public record CalendarOccurrenceResponse(
        LocalDate date,
        UUID userId,
        String nickname,
        LocalTime startTime,
        LocalTime endTime,
        boolean overnight,
        String type,
        UUID coverId,
        UUID relatedUserId,
        String relatedNickname
) {
}
