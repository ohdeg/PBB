package com.studiobs.spring_backend.domain.brew.dto;

import com.studiobs.spring_backend.domain.brew.entity.BrewStore;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

public record StoreResponse(
        UUID id,
        UUID ownerUserId,
        String name,
        boolean isPublic,
        /** owner에게만 노출. 그 외 null */
        String inviteCode,
        boolean owned,
        boolean subscribed,
        boolean canEditStock,
        boolean onDuty,
        /** 열람자 본인의 퇴사 예정일(마지막 근무일). 없으면 null */
        LocalDate leaveDate,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
    public static StoreResponse from(
            BrewStore store,
            UUID viewerUserId,
            boolean subscribed,
            boolean canEditStock,
            boolean onDuty,
            LocalDate leaveDate
    ) {
        boolean owned = viewerUserId != null && store.getOwnerUserId().equals(viewerUserId);
        return new StoreResponse(
                store.getId(),
                store.getOwnerUserId(),
                store.getName(),
                store.isPublic(),
                owned ? store.getInviteCode() : null,
                owned,
                subscribed,
                owned || canEditStock,
                owned || onDuty,
                leaveDate,
                store.getCreatedAt(),
                store.getUpdatedAt()
        );
    }
}
