package com.studiobs.spring_backend.domain.lotto.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record SaveLottoUserPicksRequest(
        Integer targetRound,
        @NotNull @NotBlank String itemsJson
) {
}
