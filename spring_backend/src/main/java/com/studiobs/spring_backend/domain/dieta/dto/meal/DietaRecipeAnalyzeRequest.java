package com.studiobs.spring_backend.domain.dieta.dto.meal;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public record DietaRecipeAnalyzeRequest(
        @NotNull LocalDate loggedOn,
        /** Optional; ignored on create — meal type is chosen at add-to-day. */
        String mealType,
        @NotBlank String title,
        @NotEmpty List<@NotBlank String> ingredients,
        String steps,
        /** Batch servings the ingredient list was written for (e.g. 2, 4). Macros stored per 1 serving. */
        @NotNull @DecimalMin(value = "0.01", inclusive = true) BigDecimal servings
) {
}
