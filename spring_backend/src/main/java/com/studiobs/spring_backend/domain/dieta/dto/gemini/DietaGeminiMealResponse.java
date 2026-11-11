package com.studiobs.spring_backend.domain.dieta.dto.gemini;

import java.math.BigDecimal;
import java.time.LocalDate;

public record DietaGeminiMealResponse(
        int schemaVersion,
        LocalDate loggedOn,
        Totals totals,
        String oneLineReview,
        tools.jackson.databind.JsonNode mealTotals, tools.jackson.databind.JsonNode foods
) {
    public DietaGeminiMealResponse(int schemaVersion, LocalDate loggedOn, Totals totals, String review) {
        this(schemaVersion, loggedOn, totals, review, null, null);
    }

    public DietaGeminiMealResponse(int version, LocalDate day, Totals totals, String review, tools.jackson.databind.JsonNode meals) {
        this(version, day, totals, review, meals, null);
    }

    public record Totals(
            BigDecimal carbG,
            BigDecimal proteinG,
            BigDecimal fatG,
            int kcal
    ) {
    }
}
