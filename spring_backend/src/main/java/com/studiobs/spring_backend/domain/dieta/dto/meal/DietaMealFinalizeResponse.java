package com.studiobs.spring_backend.domain.dieta.dto.meal;

import com.studiobs.spring_backend.domain.dieta.dto.DietaIntakeLogResponse;

public record DietaMealFinalizeResponse(
        DietaIntakeLogResponse intake,
        DietaMealQueueDayResponse queue
) {
}
