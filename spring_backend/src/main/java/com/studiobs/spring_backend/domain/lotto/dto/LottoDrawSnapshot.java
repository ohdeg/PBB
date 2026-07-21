package com.studiobs.spring_backend.domain.lotto.dto;

import java.time.LocalDate;

/**
 * replace 병합 보존용 기존 값 스냅샷.
 * 엔티티가 아닌 DTO 프로젝션이라 영속성 컨텍스트를 오염시키지 않는다.
 */
public record LottoDrawSnapshot(
        Integer round,
        Integer bonusNumber,
        LocalDate drawDate,
        Long firstPrizeAmount,
        Integer firstPrizeWinnerCount
) {
}
