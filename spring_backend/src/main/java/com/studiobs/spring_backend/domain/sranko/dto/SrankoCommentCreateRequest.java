package com.studiobs.spring_backend.domain.sranko.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.UUID;

public record SrankoCommentCreateRequest(
        @NotBlank @Size(max = 500) String body,
        UUID parentId
) {
}
