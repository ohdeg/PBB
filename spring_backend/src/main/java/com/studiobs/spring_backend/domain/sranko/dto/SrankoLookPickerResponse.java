package com.studiobs.spring_backend.domain.sranko.dto;

import com.studiobs.spring_backend.domain.sranko.entity.SrankoLook;
import java.time.LocalDateTime;
import java.util.UUID;

/** Lightweight look row for community image picker — no item hydrate. */
public record SrankoLookPickerResponse(
        UUID id,
        String name,
        String imageUrl,
        LocalDateTime createdAt
) {
    public static SrankoLookPickerResponse from(SrankoLook look) {
        return new SrankoLookPickerResponse(
                look.getId(),
                look.getName(),
                look.getImageUrl(),
                look.getCreatedAt()
        );
    }
}
