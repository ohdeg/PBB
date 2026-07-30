package com.studiobs.spring_backend.domain.dieta.dto.meal;

import com.studiobs.spring_backend.domain.dieta.dto.DietaIntakeLogResponse;
import java.math.BigDecimal;

public record DietaRecipeAnalyzeResponse(
        String recipeId,
        BigDecimal carbG,
        BigDecimal proteinG,
        BigDecimal fatG,
        int kcal,
        String oneLineReview,
        BigDecimal servings,
        DietaIntakeLogResponse intake
) {
}
