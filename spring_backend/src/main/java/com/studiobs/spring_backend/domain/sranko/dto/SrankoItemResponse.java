package com.studiobs.spring_backend.domain.sranko.dto;

import com.studiobs.spring_backend.domain.sranko.entity.SrankoItem;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.UUID;

public record SrankoItemResponse(
        UUID id,
        String slot,
        String categoryCode,
        Integer warmth,
        String name,
        String imageUrl,
        Map<String, String> measurements,
        LocalDateTime createdAt
) {
    public static SrankoItemResponse from(SrankoItem item, Map<String, String> measurements) {
        return new SrankoItemResponse(
                item.getId(),
                item.getSlot(),
                item.getCategoryCode(),
                item.getWarmth(),
                item.getName(),
                item.getImageUrl(),
                measurements,
                item.getCreatedAt()
        );
    }
}
