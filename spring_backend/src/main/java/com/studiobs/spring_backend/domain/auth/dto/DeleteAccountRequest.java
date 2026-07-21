package com.studiobs.spring_backend.domain.auth.dto;

import jakarta.validation.constraints.NotBlank;

public record DeleteAccountRequest(
        @NotBlank String password
) {
}
