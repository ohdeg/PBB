package com.studiobs.spring_backend.domain.brew.dto;

import com.studiobs.spring_backend.domain.brew.entity.BrewStaffSchedule;
import java.time.LocalTime;
import java.util.UUID;

public record ScheduleResponse(
        UUID id,
        UUID storeId,
        UUID userId,
        String nickname,
        int dayOfWeek,
        LocalTime startTime,
        LocalTime endTime,
        boolean overnight
) {
    public static ScheduleResponse from(BrewStaffSchedule schedule, String nickname) {
        return new ScheduleResponse(
                schedule.getId(),
                schedule.getStoreId(),
                schedule.getUserId(),
                nickname,
                schedule.getDayOfWeek(),
                schedule.getStartTime(),
                schedule.getEndTime(),
                schedule.isOvernight()
        );
    }
}
