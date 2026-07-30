package com.studiobs.spring_backend.domain.dieta.dto.meal;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public record DietaRecipeResponse(
        UUID id,
        LocalDate loggedOn,
        String mealType,
        String title,
        List<String> ingredients,
        String steps,
        BigDecimal carbG,
        BigDecimal proteinG,
        BigDecimal fatG,
        int kcal,
        String oneLineReview,
        BigDecimal servings,
        LocalDateTime createdAt
) {
}
