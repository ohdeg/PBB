package com.studiobs.spring_backend.domain.brew.dto;

import com.studiobs.spring_backend.domain.brew.entity.BrewRecipe;
import java.time.LocalDateTime;
import java.util.UUID;

public record RecipeResponse(
        UUID id,
        UUID menuId,
        String contents,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
    public static RecipeResponse from(BrewRecipe recipe) {
        return new RecipeResponse(
                recipe.getId(),
                recipe.getMenuId(),
                recipe.getContents(),
                recipe.getCreatedAt(),
                recipe.getUpdatedAt()
        );
    }
}
