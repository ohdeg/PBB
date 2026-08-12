package com.studiobs.spring_backend.domain.lotto.dto;

/** 연속 특징(합·span·AC)의 분위수 밴드. */
public record ContinuousPreferenceDto(
        double p10,
        double p25,
        double p50,
        double p75,
        double p90,
        int sampleSize
) {
}
