package com.studiobs.spring_backend.domain.dev.dto;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.List;

public record UpdateFeaturedAppRequest(
        @NotEmpty(message = "추천 앱을 하나 이상 선택해 주세요.")
        @Size(max = 5, message = "추천 앱은 최대 5개까지 선택할 수 있습니다.")
        List<@NotBlank @Size(max = 64) String> appIds
) {
}
