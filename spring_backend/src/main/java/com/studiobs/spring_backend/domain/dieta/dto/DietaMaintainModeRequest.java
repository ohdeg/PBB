package com.studiobs.spring_backend.domain.dieta.dto;

import jakarta.validation.constraints.NotNull;

public record DietaMaintainModeRequest(
        @NotNull Boolean enabled
) {
}
