package com.studiobs.spring_backend.domain.auth.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record ConsentAgreementRequest(
        @NotBlank(message = "동의 항목 키가 필요합니다.")
        String key,

        @NotNull(message = "동의 여부가 필요합니다.")
        Boolean agreed,

        @NotBlank(message = "동의 문서 버전이 필요합니다.")
        String version
) {
}
