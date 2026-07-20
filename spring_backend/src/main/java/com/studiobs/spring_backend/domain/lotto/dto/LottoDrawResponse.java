package com.studiobs.spring_backend.domain.lotto.dto;

import com.studiobs.spring_backend.domain.lotto.entity.LottoDraw;
import java.time.LocalDate;
import java.util.Arrays;
import java.util.List;

public record LottoDrawResponse(
        int round,
        List<Integer> mainNumbers,
        Integer bonusNumber,
        LocalDate drawDate,
        Long firstPrizeAmount,
        Integer firstPrizeWinnerCount
) {
    public static LottoDrawResponse from(LottoDraw draw) {
        return new LottoDrawResponse(
                draw.getRound(),
                parseMainNumbers(draw.getMainNumbers()),
                draw.getBonusNumber(),
                draw.getDrawDate(),
                draw.getFirstPrizeAmount(),
                draw.getFirstPrizeWinnerCount()
        );
    }

    static List<Integer> parseMainNumbers(String raw) {
        return Arrays.stream(raw.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .map(Integer::valueOf)
                .toList();
    }
}
