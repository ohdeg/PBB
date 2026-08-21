package com.studiobs.spring_backend.domain.brew.support;

import static org.assertj.core.api.Assertions.assertThat;

import com.studiobs.spring_backend.domain.brew.entity.BrewStaffSchedule;
import com.studiobs.spring_backend.domain.brew.entity.BrewStaffScheduleOverride;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class BrewEffectiveShiftsTest {

    private static final UUID USER = UUID.fromString("11111111-1111-1111-1111-111111111111");
    private static final UUID STORE = UUID.fromString("22222222-2222-2222-2222-222222222222");

    @Test
    void weeklyVersionAppliesFromEffectiveDate() {
        BrewStaffSchedule oldShift = version(5, "09:00", "18:00", LocalDate.of(1970, 1, 1), true);
        BrewStaffSchedule nextShift = version(5, "10:00", "19:00", LocalDate.of(2026, 8, 21), true);
        List<BrewStaffSchedule> versions = List.of(oldShift, nextShift);

        BrewEffectiveShifts.Shift before = BrewEffectiveShifts.resolve(
                versions, null, LocalDate.of(2026, 8, 14));
        BrewEffectiveShifts.Shift onDay = BrewEffectiveShifts.resolve(
                versions, null, LocalDate.of(2026, 8, 21));

        assertThat(before).isEqualTo(new BrewEffectiveShifts.Shift(
                LocalTime.of(9, 0), LocalTime.of(18, 0)));
        assertThat(onDay).isEqualTo(new BrewEffectiveShifts.Shift(
                LocalTime.of(10, 0), LocalTime.of(19, 0)));
    }

    @Test
    void oneDayOverrideWinsThenWeeklyResumes() {
        BrewStaffSchedule weekly = version(5, "09:00", "18:00", LocalDate.of(1970, 1, 1), true);
        LocalDate once = LocalDate.of(2026, 8, 21);
        BrewStaffScheduleOverride override = BrewStaffScheduleOverride.builder()
                .storeId(STORE)
                .userId(USER)
                .workDate(once)
                .startTime(LocalTime.of(10, 0))
                .endTime(LocalTime.of(19, 0))
                .active(true)
                .build();

        BrewEffectiveShifts.Shift onDay = BrewEffectiveShifts.resolve(List.of(weekly), override, once);
        BrewEffectiveShifts.Shift nextWeek = BrewEffectiveShifts.resolve(
                List.of(weekly), null, once.plusDays(7));

        assertThat(onDay).isEqualTo(new BrewEffectiveShifts.Shift(
                LocalTime.of(10, 0), LocalTime.of(19, 0)));
        assertThat(nextWeek).isEqualTo(new BrewEffectiveShifts.Shift(
                LocalTime.of(9, 0), LocalTime.of(18, 0)));
    }

    @Test
    void inactiveOverrideClearsTheDay() {
        BrewStaffSchedule weekly = version(5, "09:00", "18:00", LocalDate.of(1970, 1, 1), true);
        BrewStaffScheduleOverride off = BrewStaffScheduleOverride.builder()
                .storeId(STORE)
                .userId(USER)
                .workDate(LocalDate.of(2026, 8, 21))
                .active(false)
                .build();

        assertThat(BrewEffectiveShifts.resolve(List.of(weekly), off, LocalDate.of(2026, 8, 21)))
                .isNull();
    }

    private static BrewStaffSchedule version(
            int dayOfWeek,
            String start,
            String end,
            LocalDate from,
            boolean active
    ) {
        return BrewStaffSchedule.builder()
                .storeId(STORE)
                .userId(USER)
                .dayOfWeek(dayOfWeek)
                .startTime(LocalTime.parse(start))
                .endTime(LocalTime.parse(end))
                .effectiveFrom(from)
                .active(active)
                .build();
    }
}
