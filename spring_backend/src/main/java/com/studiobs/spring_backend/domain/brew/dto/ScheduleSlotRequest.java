package com.studiobs.spring_backend.domain.brew.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import java.time.LocalTime;

public record ScheduleSlotRequest(
        @NotNull @Min(1) @Max(7) Integer dayOfWeek,
        @NotNull LocalTime startTime,
        @NotNull LocalTime endTime
) {
}
