package com.studiobs.spring_backend.domain.brew.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record StockRequest(
        @NotBlank(message = "재고 이름을 입력해 주세요.")
        @Size(max = 255)
        String stockName,

        @NotNull
        @Min(0)
        Integer stockNum,

        @Min(0)
        Integer stockMinNum
) {
}
