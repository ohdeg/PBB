package com.studiobs.spring_backend.domain.brew.support;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;

public final class BrewShiftTimes {

    public static final ZoneId ZONE = ZoneId.of("Asia/Seoul");

    private BrewShiftTimes() {
    }

    public static boolean isOvernight(LocalTime start, LocalTime end) {
        return end.isBefore(start);
    }

    public static void requireValidRange(LocalTime start, LocalTime end) {
        if (start == null || end == null) {
            throw new IllegalArgumentException("시작·종료 시간이 필요합니다.");
        }
        if (start.equals(end)) {
            throw new IllegalArgumentException("시작 시간과 종료 시간이 같을 수 없습니다.");
        }
    }

    public static LocalDateTime rangeStart(LocalDate workDate, LocalTime start) {
        return LocalDateTime.of(workDate, start);
    }

    public static LocalDateTime rangeEnd(LocalDate workDate, LocalTime start, LocalTime end) {
        if (isOvernight(start, end)) {
            return LocalDateTime.of(workDate.plusDays(1), end);
        }
        return LocalDateTime.of(workDate, end);
    }

    public static boolean isWithinShift(
            LocalDateTime now,
            LocalDate workDate,
            LocalTime start,
            LocalTime end
    ) {
        LocalDateTime from = rangeStart(workDate, start);
        LocalDateTime to = rangeEnd(workDate, start, end);
        return !now.isBefore(from) && now.isBefore(to);
    }

    public static LocalDateTime nowSeoul() {
        return LocalDateTime.now(ZONE);
    }
}
