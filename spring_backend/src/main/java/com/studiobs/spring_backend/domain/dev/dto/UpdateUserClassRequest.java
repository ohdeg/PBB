package com.studiobs.spring_backend.domain.dev.dto;

import com.studiobs.spring_backend.domain.user.entity.UserClass;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record UpdateUserClassRequest(
        @NotBlank(message = "닉네임 또는 이메일을 입력해 주세요.")
        String query,

        @NotNull(message = "회원 등급을 지정해 주세요.")
        UserClass userClass
) {
}
