package com.studiobs.spring_backend.domain.brew.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import java.util.List;

public record PosPollRequest(
        @NotEmpty
        @Valid
        List<@NotNull PosPairSecret> pairs
) {
}
