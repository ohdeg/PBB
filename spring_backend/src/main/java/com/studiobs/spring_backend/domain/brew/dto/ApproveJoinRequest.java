package com.studiobs.spring_backend.domain.brew.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;
import java.util.List;

public record ApproveJoinRequest(
        @NotNull Boolean canEditStock,
        /** 첫 근무일. null이면 즉시 적용 */
        LocalDate workStartDate,
        @NotNull @Valid List<ScheduleSlotRequest> slots
) {
}
