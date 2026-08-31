package com.studiobs.spring_backend.domain.brew.dto;

import jakarta.validation.constraints.Size;

public record CallBellPhraseRequest(
        @Size(max = 200)
        String phrase
) {
}
