package com.studiobs.spring_backend.domain.sranko.dto;

import com.studiobs.spring_backend.domain.sranko.entity.SrankoLook;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public record SrankoLookResponse(
        UUID id,
        String name,
        String imageUrl,
        List<UUID> itemIds,
        List<SrankoLookItemDto> items,
        String source,
        LocalDateTime createdAt
) {
    public static SrankoLookResponse from(
            SrankoLook look,
            List<UUID> itemIds,
            List<SrankoLookItemDto> items
    ) {
        return new SrankoLookResponse(
                look.getId(),
                look.getName(),
                look.getImageUrl(),
                itemIds,
                items != null ? items : List.of(),
                look.getSource(),
                look.getCreatedAt()
        );
    }
}
