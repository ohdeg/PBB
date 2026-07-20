package com.studiobs.spring_backend.domain.brew.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record NameRequest(
        @NotBlank(message = "이름을 입력해 주세요.")
        @Size(max = 255)
        String name
) {
}
