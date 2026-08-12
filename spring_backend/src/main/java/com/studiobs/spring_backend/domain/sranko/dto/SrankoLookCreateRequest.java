package com.studiobs.spring_backend.domain.sranko.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.UUID;

public record SrankoLookCreateRequest(
        @NotBlank @Size(max = 120) String name,
        @NotBlank @Size(max = 512) String imageUrl,
        List<UUID> itemIds,
        @NotBlank @Pattern(regexp = "COMPOSE|TRY_ON") String source
) {
}
