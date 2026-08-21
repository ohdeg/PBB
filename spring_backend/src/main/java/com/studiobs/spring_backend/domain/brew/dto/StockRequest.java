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
        Integer stockMinNum,

        /** 수정(PATCH) 시 필수. 생성(POST) 시 생략. */
        @Min(0)
        Integer version,

        /** 수정(PATCH) 시 지정하면 같은 가게 다른 카테고리로 이동. 생성(POST) 시 무시. */
        Integer categoryId
) {
}
