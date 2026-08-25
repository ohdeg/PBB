package com.studiobs.spring_backend.domain.sranko.dto;

public record SrankoRembgResponse(
        String imagePngBase64,
        int width,
        int height
) {
}
