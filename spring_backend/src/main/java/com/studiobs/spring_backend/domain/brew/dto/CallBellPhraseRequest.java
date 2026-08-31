package com.studiobs.spring_backend.domain.brew.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Size;

public record CallBellPhraseRequest(
        @Size(max = 200)
        String phrase,
        @DecimalMin("0.5")
        @DecimalMax("2")
        Double rate,
        @DecimalMin("0")
        @DecimalMax("2")
        Double pitch
) {
}
