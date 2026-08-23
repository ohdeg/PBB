package com.studiobs.spring_backend.domain.brew.support;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;

/** Pure open-window rules. Callers load templates/items/runs in batch (no N+1). */
public final class BrewChecklistOpen {

    public static final String CLOCK = "CLOCK";
    public static final String SHIFT_START = "SHIFT_START";
    public static final String SHIFT_END = "SHIFT_END";
    public static final String MANUAL = "MANUAL";
    public static final String ON_DUTY = "ON_DUTY";
    public static final String OWNER_ONLY = "OWNER_ONLY";

    public record ShiftWindow(LocalDate workDate, LocalTime start, LocalTime end) {
        public boolean overnight() {
            return end.isBefore(start);
        }
    }

    private BrewChecklistOpen() {
    }

    public static boolean matchesDows(String triggerDows, int isoDow) {
        if (triggerDows == null || triggerDows.isBlank()) {
            return true;
        }
        for (String part : triggerDows.split(",")) {
            if (part.trim().equals(String.valueOf(isoDow))) {
                return true;
            }
        }
        return false;
    }

    public static boolean workingToday(boolean onDuty, ShiftWindow todayShift) {
        return onDuty || todayShift != null;
    }

    public static boolean isDue(
            String triggerType,
            LocalTime triggerTime,
            String triggerDows,
            boolean enabled,
            boolean personal,
            String audience,
            boolean isOwner,
            boolean onDuty,
            LocalDateTime now,
            ShiftWindow todayShift,
            ShiftWindow yesterdayShift
    ) {
        if (!enabled) {
            return false;
        }
        if (MANUAL.equals(triggerType)) {
            return false;
        }
        if (!personal) {
            if (OWNER_ONLY.equals(audience) && !isOwner) {
                return false;
            }
            if (!OWNER_ONLY.equals(audience) && !workingToday(onDuty, todayShift)) {
                return false;
            }
        }
        if (CLOCK.equals(triggerType)) {
            if (triggerTime == null) {
                return false;
            }
            if (!matchesDows(triggerDows, now.getDayOfWeek().getValue())) {
                return false;
            }
            return !now.toLocalTime().isBefore(triggerTime);
        }
        if (SHIFT_START.equals(triggerType)) {
            if (todayShift == null) {
                return false;
            }
            return !now.isBefore(BrewShiftTimes.rangeStart(todayShift.workDate(), todayShift.start()));
        }
        if (SHIFT_END.equals(triggerType)) {
            if (todayShift != null) {
                LocalDateTime end = BrewShiftTimes.rangeEnd(
                        todayShift.workDate(), todayShift.start(), todayShift.end());
                if (!now.isBefore(end)) {
                    return true;
                }
            }
            if (yesterdayShift != null && yesterdayShift.overnight()) {
                LocalDateTime end = BrewShiftTimes.rangeEnd(
                        yesterdayShift.workDate(), yesterdayShift.start(), yesterdayShift.end());
                return !now.isBefore(end);
            }
            return false;
        }
        return false;
    }
}
