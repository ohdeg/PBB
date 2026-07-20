package com.studiobs.spring_backend.domain.brew.dto;

public record TimerPresetStepResponse(
        String name,
        long durationMs
) {
}
