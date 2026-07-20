package com.studiobs.spring_backend.domain.brew.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record TimerPresetStepRequest(
        @NotBlank @Size(max = 120) String name,
        @Min(1000) long durationMs
) {
}
