package com.studiobs.spring_backend.domain.sranko.dto;

import com.studiobs.spring_backend.domain.sranko.entity.SrankoPostComment;
import java.time.LocalDateTime;
import java.util.UUID;

public record SrankoCommentResponse(
        UUID id,
        UUID postId,
        UUID parentId,
        String body,
        String authorNickname,
        UUID authorUserId,
        int likeCount,
        boolean likedByMe,
        LocalDateTime createdAt
) {
    public static SrankoCommentResponse from(
            SrankoPostComment comment,
            String authorNickname,
            boolean likedByMe
    ) {
        return new SrankoCommentResponse(
                comment.getId(),
                comment.getPostId(),
                comment.getParentId(),
                comment.getBody(),
                authorNickname,
                comment.getAuthorUserId(),
                comment.getLikeCount(),
                likedByMe,
                comment.getCreatedAt()
        );
    }
}
