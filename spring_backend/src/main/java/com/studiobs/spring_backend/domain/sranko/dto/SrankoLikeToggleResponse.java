package com.studiobs.spring_backend.domain.sranko.dto;

public record SrankoLikeToggleResponse(
        int likeCount,
        boolean likedByMe
) {
}
