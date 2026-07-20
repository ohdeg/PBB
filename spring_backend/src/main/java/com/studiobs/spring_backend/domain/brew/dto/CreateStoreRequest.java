package com.studiobs.spring_backend.domain.brew.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreateStoreRequest(
        @NotBlank(message = "가게 이름을 입력해 주세요.")
        @Size(max = 120)
        String name,

        boolean isPublic
) {
}
