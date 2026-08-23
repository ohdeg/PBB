package com.studiobs.spring_backend.domain.brew.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import java.time.LocalTime;
import java.util.List;

public record ChecklistRequest(
        @NotBlank @Size(max = 120) String title,
        @NotBlank String triggerType,
        LocalTime triggerTime,
        List<Integer> triggerDows,
        String audience,
        boolean interrupt,
        boolean enabled,
        boolean personal,
        @NotEmpty @Size(max = 40) List<@NotBlank @Size(max = 200) String> items
) {
}
