package com.studiobs.spring_backend.domain.dieta.dto;

import java.util.UUID;

public record DietaWorkout(UUID id, String name, Integer durationMin, Integer exerciseKcal, String source, UUID sourceId) {}
