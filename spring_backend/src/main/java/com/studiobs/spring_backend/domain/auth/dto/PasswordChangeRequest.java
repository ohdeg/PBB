package com.studiobs.spring_backend.domain.auth.dto;

import com.studiobs.spring_backend.global.common.ValidationPatterns;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public record PasswordChangeRequest(
        @NotBlank(message = "비밀번호를 입력해 주세요.")
        @Pattern(
                regexp = ValidationPatterns.PASSWORD,
                message = "비밀번호는 8~16자이며 영문·숫자·특수문자를 모두 포함해야 합니다."
        )
        String newPassword
) {
}
