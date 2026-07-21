package com.studiobs.spring_backend.domain.brew.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record NoticeRequest(
        @NotBlank(message = "제목을 입력해 주세요.")
        @Size(max = 200)
        String title,

        @NotBlank(message = "본문을 입력해 주세요.")
        @Size(max = 10000)
        String body
) {
}
