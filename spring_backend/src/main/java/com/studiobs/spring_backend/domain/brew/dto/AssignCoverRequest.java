package com.studiobs.spring_backend.domain.brew.dto;

import jakarta.validation.constraints.NotNull;
import java.util.UUID;

public record AssignCoverRequest(
        @NotNull UUID coverUserId
) {
}
