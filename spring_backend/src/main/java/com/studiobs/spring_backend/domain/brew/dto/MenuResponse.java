package com.studiobs.spring_backend.domain.brew.dto;

import com.studiobs.spring_backend.domain.brew.entity.BrewMenu;
import java.time.LocalDateTime;
import java.util.UUID;

public record MenuResponse(
        UUID id,
        UUID storeId,
        String name,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
    public static MenuResponse from(BrewMenu menu) {
        return new MenuResponse(
                menu.getId(),
                menu.getStoreId(),
                menu.getName(),
                menu.getCreatedAt(),
                menu.getUpdatedAt()
        );
    }
}
