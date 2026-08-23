package com.studiobs.spring_backend.domain.brew.dto;

import jakarta.validation.constraints.NotNull;

public record ChecklistCheckRequest(
        @NotNull Integer itemId,
        boolean checked
) {
}
