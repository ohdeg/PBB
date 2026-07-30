package com.studiobs.spring_backend.domain.dieta.dto.meal;

import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;

public record DietaRecipeAddToDayRequest(
        @NotNull LocalDate loggedOn,
        String mealType
) {
}
