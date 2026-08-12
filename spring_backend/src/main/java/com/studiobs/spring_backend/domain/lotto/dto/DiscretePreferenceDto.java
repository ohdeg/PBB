package com.studiobs.spring_backend.domain.lotto.dto;

import java.util.Map;

/** 이산 특징(홀짝 개수 등)의 관측 분포. */
public record DiscretePreferenceDto(
        Map<Integer, Integer> counts,
        int mode,
        int sampleSize
) {
}
