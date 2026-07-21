package com.studiobs.spring_backend.domain.brew.dto;

import com.studiobs.spring_backend.domain.brew.entity.BrewStoreNotice;
import java.time.LocalDateTime;
import java.util.UUID;

public record NoticeResponse(
        UUID id,
        UUID storeId,
        UUID authorUserId,
        String authorNickname,
        String title,
        String body,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
    public static NoticeResponse from(BrewStoreNotice notice, String authorNickname) {
        return new NoticeResponse(
                notice.getId(),
                notice.getStoreId(),
                notice.getAuthorUserId(),
                authorNickname == null ? "" : authorNickname,
                notice.getTitle(),
                notice.getBody(),
                notice.getCreatedAt(),
                notice.getUpdatedAt()
        );
    }
}
