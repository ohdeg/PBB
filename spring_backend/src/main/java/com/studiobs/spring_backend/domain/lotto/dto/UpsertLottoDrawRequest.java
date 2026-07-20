package com.studiobs.spring_backend.domain.lotto.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import java.util.List;

public record UpsertLottoDrawRequest(
        @NotNull @Min(1) Integer round,
        @NotEmpty @Size(min = 6, max = 6) List<@NotNull @Min(1) @Max(45) Integer> mainNumbers,
        @Min(1) @Max(45) Integer bonusNumber,
        LocalDate drawDate,
        @Min(0) Long firstPrizeAmount,
        @Min(0) Integer firstPrizeWinnerCount
) {
}
