package com.studiobs.spring_backend.domain.lotto.client;

import java.util.List;

/** 파싱·검증이 끝난 동행복권 회차 결과. */
public record DhLotteryDrawResponse(
        Integer round,
        List<Integer> mainNumbers,
        Integer bonusNumber,
        String drawDate,
        Long firstPrizeAmount,
        Integer firstPrizeWinnerCount
) {
}
