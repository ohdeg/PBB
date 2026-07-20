package com.studiobs.spring_backend.domain.brew.dto;

import jakarta.validation.constraints.NotBlank;

public record RecipeContentsRequest(
        @NotBlank(message = "레시피 내용을 입력해 주세요.")
        String contents
) {
}
