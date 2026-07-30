package com.studiobs.spring_backend.domain.dieta.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;

public record DietaMacroPercentsDto(
        @NotNull @DecimalMin("0") @DecimalMax("1") Double carbPct,
        @NotNull @DecimalMin("0") @DecimalMax("1") Double proteinPct,
        @NotNull @DecimalMin("0") @DecimalMax("1") Double fatPct
) {
}
