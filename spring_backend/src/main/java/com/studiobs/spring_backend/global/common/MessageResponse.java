package com.studiobs.spring_backend.global.common;

import com.fasterxml.jackson.annotation.JsonInclude;

public record MessageResponse(
        String message,
        @JsonInclude(JsonInclude.Include.NON_NULL) String code
) {
    public MessageResponse(String message) {
        this(message, null);
    }
}
