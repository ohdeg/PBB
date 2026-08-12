package com.studiobs.spring_backend.domain.sranko.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import java.util.List;

public record SrankoPostCreateRequest(
        @NotBlank @Size(max = 200) String subject,
        @NotBlank String content,
        @NotEmpty @Size(min = 1, max = 10) List<@NotBlank @Size(max = 512) String> imageUrls
) {
}
