package com.studiobs.spring_backend.domain.sranko.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.time.LocalDateTime;
import java.util.UUID;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UuidGenerator;
import org.hibernate.type.SqlTypes;

@Entity
@Table(
        name = "sranko_post_comment_likes",
        uniqueConstraints = @UniqueConstraint(
                name = "uq_sranko_comment_likes_comment_user",
                columnNames = {"comment_id", "user_id"}
        )
)
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class SrankoPostCommentLike {

    @Id
    @GeneratedValue
    @UuidGenerator
    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(length = 36, updatable = false, nullable = false)
    private UUID id;

    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(name = "comment_id", nullable = false, length = 36)
    private UUID commentId;

    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(name = "user_id", nullable = false, length = 36)
    private UUID userId;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @Builder
    public SrankoPostCommentLike(UUID commentId, UUID userId) {
        this.commentId = commentId;
        this.userId = userId;
    }
}
