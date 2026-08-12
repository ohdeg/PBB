package com.studiobs.spring_backend.domain.sranko.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.Map;
import java.util.UUID;

public record SrankoItemUpsertRequest(
        UUID id,
        @NotBlank @Pattern(regexp = "TOP|BOTTOM|OUTER|SHOES|DRESS|BAG|HAT|JEWELRY") String slot,
        @NotBlank @Size(max = 64) String categoryCode,
        Integer warmth,
        @NotBlank @Size(max = 120) String name,
        @NotBlank @Size(max = 512) String imageUrl,
        Map<String, String> measurements
) {
}
