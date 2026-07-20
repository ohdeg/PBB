package com.studiobs.spring_backend.domain.lotto.dto;

import jakarta.validation.constraints.NotNull;

public record LottoUserPicksResponse(
        Integer targetRound,
        @NotNull String itemsJson
) {
}
