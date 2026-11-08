package com.studiobs.spring_backend.domain.dieta.dto.meal;

import java.time.Instant;

public record DietaMealSchedule(boolean enabled, String time, String zone, Instant nextRunAt) {
    public static DietaMealSchedule disabled() {
        return new DietaMealSchedule(false, null, null, null);
    }
}
