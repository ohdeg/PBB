package com.studiobs.spring_backend.domain.brew.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import java.util.List;

public record TimerPresetRequest(
        @NotBlank @Size(max = 120) String name,
        @NotEmpty List<@Valid TimerPresetStepRequest> steps
) {
}
