package com.studiobs.spring_backend.domain.brew.dto;

import com.studiobs.spring_backend.domain.brew.entity.BrewShiftCover;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.UUID;

public record CoverResponse(
        UUID id,
        UUID storeId,
        UUID originalUserId,
        String originalNickname,
        UUID coverUserId,
        String coverNickname,
        LocalDate workDate,
        LocalTime startTime,
        LocalTime endTime,
        boolean overnight,
        String initiatorType,
        UUID requestedByUserId,
        String status,
        String note,
        UUID decidedByUserId,
        LocalDateTime decidedAt,
        LocalDateTime createdAt
) {
    public static CoverResponse from(
            BrewShiftCover cover,
            String originalNickname,
            String coverNickname
    ) {
        return new CoverResponse(
                cover.getId(),
                cover.getStoreId(),
                cover.getOriginalUserId(),
                originalNickname,
                cover.getCoverUserId(),
                coverNickname,
                cover.getWorkDate(),
                cover.getStartTime(),
                cover.getEndTime(),
                cover.isOvernight(),
                cover.getInitiatorType(),
                cover.getRequestedByUserId(),
                cover.getStatus(),
                cover.getNote(),
                cover.getDecidedByUserId(),
                cover.getDecidedAt(),
                cover.getCreatedAt()
        );
    }
}
