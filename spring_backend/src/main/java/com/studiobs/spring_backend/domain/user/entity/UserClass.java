package com.studiobs.spring_backend.domain.user.entity;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

/**
 * 회원 등급. 회원가입 시 항상 {@link #FREE}로 생성되며,
 * {@link #DEV}만 다른 회원을 승격·변경할 수 있다.
 */
public enum UserClass {
    FREE("free"),
    DEV("dev");

    private final String value;

    UserClass(String value) {
        this.value = value;
    }

    @JsonValue
    public String getValue() {
        return value;
    }

    @JsonCreator
    public static UserClass from(String raw) {
        if (raw == null || raw.isBlank()) {
            throw new IllegalArgumentException("userClass가 비어 있습니다.");
        }
        String normalized = raw.trim().toLowerCase();
        for (UserClass userClass : values()) {
            if (userClass.value.equals(normalized) || userClass.name().equalsIgnoreCase(raw.trim())) {
                return userClass;
            }
        }
        throw new IllegalArgumentException("지원하지 않는 userClass입니다: " + raw);
    }

    public boolean isDev() {
        return this == DEV;
    }
}
