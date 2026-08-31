package com.studiobs.spring_backend.domain.brew.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record PosCreateSessionRequest(
        @NotBlank
        @Size(min = 8, max = 64)
        @Pattern(regexp = "[a-zA-Z0-9_-]+")
        String deviceId
) {
}
