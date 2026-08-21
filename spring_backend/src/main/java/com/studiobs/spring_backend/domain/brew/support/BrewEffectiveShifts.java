package com.studiobs.spring_backend.domain.brew.support;

import com.studiobs.spring_backend.domain.brew.entity.BrewStaffSchedule;
import com.studiobs.spring_backend.domain.brew.entity.BrewStaffScheduleOverride;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Date-effective regular shift. Callers must load versions/overrides in batch (no N+1). */
public final class BrewEffectiveShifts {

    public record Shift(LocalTime start, LocalTime end) {
        public boolean overnight() {
            return end.isBefore(start);
        }
    }

    private BrewEffectiveShifts() {
    }

    public static Shift resolve(
            List<BrewStaffSchedule> versionsForUser,
            BrewStaffScheduleOverride override,
            LocalDate date
    ) {
        if (override != null) {
            if (!override.isActive()) {
                return null;
            }
            return new Shift(override.getStartTime(), override.getEndTime());
        }
        int dow = date.getDayOfWeek().getValue();
        BrewStaffSchedule best = null;
        for (BrewStaffSchedule schedule : versionsForUser) {
            if (schedule.getDayOfWeek() != dow || schedule.getEffectiveFrom().isAfter(date)) {
                continue;
            }
            if (best == null || schedule.getEffectiveFrom().isAfter(best.getEffectiveFrom())) {
                best = schedule;
            }
        }
        if (best == null || !best.isActive()) {
            return null;
        }
        return new Shift(best.getStartTime(), best.getEndTime());
    }

    public static List<BrewStaffSchedule> weeklyAsOf(
            List<BrewStaffSchedule> versions,
            LocalDate date
    ) {
        Map<String, BrewStaffSchedule> best = new LinkedHashMap<>();
        for (BrewStaffSchedule schedule : versions) {
            if (schedule.getEffectiveFrom().isAfter(date)) {
                continue;
            }
            String key = schedule.getUserId() + "|" + schedule.getDayOfWeek();
            BrewStaffSchedule current = best.get(key);
            if (current == null || schedule.getEffectiveFrom().isAfter(current.getEffectiveFrom())) {
                best.put(key, schedule);
            }
        }
        List<BrewStaffSchedule> result = new ArrayList<>();
        for (BrewStaffSchedule schedule : best.values()) {
            if (schedule.isActive()) {
                result.add(schedule);
            }
        }
        return result;
    }

    public static String overrideKey(UUID userId, LocalDate date) {
        return userId + "|" + date;
    }
}
