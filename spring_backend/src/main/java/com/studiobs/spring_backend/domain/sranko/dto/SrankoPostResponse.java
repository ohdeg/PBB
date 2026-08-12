package com.studiobs.spring_backend.domain.sranko.dto;

import com.studiobs.spring_backend.domain.sranko.entity.SrankoPost;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public record SrankoPostResponse(
        UUID id,
        String subject,
        String content,
        String imageUrl,
        List<String> imageUrls,
        String authorNickname,
        UUID authorUserId,
        int readCount,
        int likeCount,
        int commentCount,
        boolean likedByMe,
        Boolean viewCounted,
        LocalDateTime createdAt
) {
    public static SrankoPostResponse from(
            SrankoPost post,
            List<String> imageUrls,
            String authorNickname,
            boolean likedByMe,
            Boolean viewCounted
    ) {
        List<String> urls = imageUrls == null || imageUrls.isEmpty()
                ? List.of(post.getImageUrl())
                : List.copyOf(imageUrls);
        return new SrankoPostResponse(
                post.getId(),
                post.getSubject(),
                post.getContent(),
                urls.get(0),
                urls,
                authorNickname,
                post.getAuthorUserId(),
                post.getReadCount(),
                post.getLikeCount(),
                post.getCommentCount(),
                likedByMe,
                viewCounted,
                post.getCreatedAt()
        );
    }
}
