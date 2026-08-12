package com.studiobs.spring_backend.domain.lotto.dto;

import java.util.Map;

/** 5개 분석 구간 패턴 profile 일괄 응답. 회차 없는 구간은 키 자체가 없을 수 있다. */
public record LottoPatternProfilesResponse(
        Map<String, LottoPatternProfileResponse> profiles
) {
}
