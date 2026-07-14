package com.studiobs.spring_backend.global.common;

public final class ValidationPatterns {

    private ValidationPatterns() {
    }

    /** 닉네임: 영문/숫자/한글/밑줄, 2~20자 */
    public static final String NICKNAME = "^[A-Za-z0-9가-힣_]{2,20}$";

    /** 비밀번호: 8~16자, 영문+숫자+특수문자 */
    public static final String PASSWORD =
            "^(?=.*[A-Za-z])(?=.*\\d)(?=.*[!@#$%^&*()_+=\\[\\]{};':\"\\\\|,.<>/?-]).{8,16}$";
}
