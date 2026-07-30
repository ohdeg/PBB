package com.studiobs.spring_backend.domain.dieta.dto.gemini;

import java.math.BigDecimal;
import java.time.LocalDate;

public record DietaGeminiMealResponse(
        int schemaVersion,
        LocalDate loggedOn,
        Totals totals,
        String oneLineReview
) {
    public record Totals(
            BigDecimal carbG,
            BigDecimal proteinG,
            BigDecimal fatG,
            int kcal
    ) {
    }
}
