package com.studiobs.spring_backend.domain.lotto.dto;

/**
 * 구간별 학습 패턴 profile.
 * {@code window}: {@code all} | {@code 52} | {@code 12} | {@code 8} | {@code 4}
 */
public record LottoPatternProfileResponse(
        String window,
        int sampleSize,
        double learnStrength,
        DiscretePreferenceDto oddCount,
        DiscretePreferenceDto lowCount,
        DiscretePreferenceDto primeCount,
        DiscretePreferenceDto multipleOf3Count,
        DiscretePreferenceDto decadeEmpty,
        DiscretePreferenceDto carryOver,
        DiscretePreferenceDto hasSameEnding,
        DiscretePreferenceDto hasConsecutive,
        ContinuousPreferenceDto sum,
        ContinuousPreferenceDto span,
        ContinuousPreferenceDto ac
) {
}
