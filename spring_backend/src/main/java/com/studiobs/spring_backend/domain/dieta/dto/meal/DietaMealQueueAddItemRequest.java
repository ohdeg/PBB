package com.studiobs.spring_backend.domain.dieta.dto.meal;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;

public record DietaMealQueueAddItemRequest(
        @NotNull LocalDate loggedOn,
        @NotBlank String mealType,
        @NotBlank String text
) {
}
