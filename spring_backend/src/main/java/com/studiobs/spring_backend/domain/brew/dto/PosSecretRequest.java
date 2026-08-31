package com.studiobs.spring_backend.domain.brew.dto;

import jakarta.validation.constraints.NotBlank;

public record PosSecretRequest(
        @NotBlank String secret
) {
}
