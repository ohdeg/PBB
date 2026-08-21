package com.studiobs.spring_backend.domain.brew.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;
import java.util.List;

public record ReplaceSchedulesRequest(
        @NotNull @Valid List<ScheduleSlotRequest> slots,
        @NotNull ScheduleReplaceMode mode,
        LocalDate effectiveFrom
) {
}
