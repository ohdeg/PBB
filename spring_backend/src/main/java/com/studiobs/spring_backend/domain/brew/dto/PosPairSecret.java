package com.studiobs.spring_backend.domain.brew.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.util.UUID;

public record PosPairSecret(
        @NotNull UUID pairId,
        @NotBlank String secret
) {
}
