package com.studiobs.spring_backend.domain.dieta.service;

import com.studiobs.spring_backend.domain.dieta.dto.DietaIntakeLogResponse;
import com.studiobs.spring_backend.domain.dieta.dto.meal.DietaMealQueueDayResponse;
import com.studiobs.spring_backend.domain.dieta.support.DietaIntakeSourceDocument.MacroTotals;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

public record DietaMealDay(LocalDate day, DietaMealQueueDayResponse queue, DietaIntakeLogResponse intake,
        String completedStage, Map<String,MacroTotals> mealTotals, List<Row> foods) {
    public record Row(String mealType, String name, String portion, String source, MacroTotals nutrition) {}
}
