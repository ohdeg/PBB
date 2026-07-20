package com.studiobs.spring_backend.domain.brew.dto;

import com.studiobs.spring_backend.domain.brew.entity.BrewStore;
import java.time.LocalDateTime;
import java.util.UUID;

public record StoreResponse(
        UUID id,
        UUID ownerUserId,
        String name,
        boolean isPublic,
        boolean owned,
        boolean subscribed,
        boolean canEditStock,
        boolean onDuty,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
    public static StoreResponse from(
            BrewStore store,
            UUID viewerUserId,
            boolean subscribed,
            boolean canEditStock,
            boolean onDuty
    ) {
        boolean owned = viewerUserId != null && store.getOwnerUserId().equals(viewerUserId);
        return new StoreResponse(
                store.getId(),
                store.getOwnerUserId(),
                store.getName(),
                store.isPublic(),
                owned,
                subscribed,
                owned || canEditStock,
                owned || onDuty,
                store.getCreatedAt(),
                store.getUpdatedAt()
        );
    }
}
