package com.studiobs.spring_backend.domain.dieta.service;

import java.time.*;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.assertThat;

class DietaScheduleTimeTest {
    @Test void koreanMidnightRunsForNewLocalDay() {
        Instant now = Instant.parse("2026-11-08T15:00:00Z");
        assertThat(DietaAnalysisStore.nextRun(now, LocalTime.MIDNIGHT, ZoneId.of("Asia/Seoul")))
                .isEqualTo(Instant.parse("2026-11-09T15:00:00Z"));
    }
    @Test void missingWallTimeRunsAtFirstValidInstant() {
        assertThat(DietaAnalysisStore.nextRun(Instant.parse("2026-03-08T06:00:00Z"),
                LocalTime.of(2,30), ZoneId.of("America/New_York")))
                .isEqualTo(Instant.parse("2026-03-08T07:00:00Z"));
    }
    @Test void repeatedWallTimeRunsOnlyOnFirstOccurrence() {
        ZoneId zone = ZoneId.of("America/New_York");
        LocalTime time = LocalTime.of(1,30);
        Instant first = DietaAnalysisStore.nextRun(Instant.parse("2026-11-01T04:00:00Z"), time, zone);
        assertThat(first).isEqualTo(Instant.parse("2026-11-01T05:30:00Z"));
        assertThat(DietaAnalysisStore.nextRun(first,time,zone)).isEqualTo(Instant.parse("2026-11-02T06:30:00Z"));
    }
}
