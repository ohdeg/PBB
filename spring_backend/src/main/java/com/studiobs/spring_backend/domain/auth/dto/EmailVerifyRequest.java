package com.studiobs.spring_backend.domain.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public record EmailVerifyRequest(
        @NotBlank(message = "이메일을 입력해 주세요.")
        @Email(message = "올바른 이메일 형식을 입력해 주세요.")
        String email,

        @NotBlank(message = "인증 코드를 입력해 주세요.")
        @Pattern(regexp = "^\\d{6}$", message = "6자리 숫자 인증 코드를 입력해 주세요.")
        String code
) {
}
