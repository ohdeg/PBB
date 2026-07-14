package com.studiobs.spring_backend.domain.auth.dto;

import com.studiobs.spring_backend.global.common.ValidationPatterns;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Pattern;
import java.util.List;

public record SignupRequest(
        @NotBlank(message = "이메일을 입력해 주세요.")
        @Email(message = "올바른 이메일 형식을 입력해 주세요.")
        String email,

        @NotBlank(message = "닉네임을 입력해 주세요.")
        @Pattern(
                regexp = ValidationPatterns.NICKNAME,
                message = "닉네임은 2~20자의 영문·숫자·한글·밑줄(_)만 사용할 수 있습니다."
        )
        String nickname,

        @NotBlank(message = "비밀번호를 입력해 주세요.")
        @Pattern(
                regexp = ValidationPatterns.PASSWORD,
                message = "비밀번호는 8~16자이며 영문·숫자·특수문자를 모두 포함해야 합니다."
        )
        String password,

        @NotEmpty(message = "약관 동의 정보가 필요합니다.")
        @Valid
        List<ConsentAgreementRequest> consents
) {
}
