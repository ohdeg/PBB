package com.studiobs.spring_backend.domain.sranko.dto;

import java.util.UUID;

/** Look composition row — hydrated from items in one batch (no N+1). */
public record SrankoLookItemDto(
        UUID id,
        boolean missing,
        String slot,
        String categoryCode,
        String name,
        String brand,
        String productUrl,
        String imageUrl
) {
    public static SrankoLookItemDto missing(UUID id) {
        return new SrankoLookItemDto(id, true, null, null, "삭제된 아이템", null, null, null);
    }

    public static SrankoLookItemDto from(
            UUID id,
            String slot,
            String categoryCode,
            String name,
            String brand,
            String productUrl,
            String imageUrl
    ) {
        return new SrankoLookItemDto(
                id,
                false,
                slot,
                categoryCode,
                name,
                brand,
                productUrl,
                imageUrl
        );
    }
}
