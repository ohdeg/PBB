package com.studiobs.spring_backend.domain.brew.dto;

import java.time.LocalDate;
import java.util.List;

public record CalendarResponse(
        LocalDate from,
        LocalDate to,
        List<ScheduleResponse> schedules,
        List<CoverResponse> covers,
        List<CalendarOccurrenceResponse> occurrences
) {
}
