package com.studiobs.spring_backend.domain.sranko.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import java.util.UUID;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.annotations.UuidGenerator;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "sranko_post_comments")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class SrankoPostComment {

    @Id
    @GeneratedValue
    @UuidGenerator
    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(length = 36, updatable = false, nullable = false)
    private UUID id;

    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(name = "post_id", nullable = false, length = 36)
    private UUID postId;

    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(name = "author_user_id", nullable = false, length = 36)
    private UUID authorUserId;

    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(name = "parent_id", length = 36)
    private UUID parentId;

    @Column(nullable = false, length = 500)
    private String body;

    @Column(name = "like_count", nullable = false)
    private int likeCount;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @Builder
    public SrankoPostComment(UUID postId, UUID authorUserId, UUID parentId, String body) {
        this.postId = postId;
        this.authorUserId = authorUserId;
        this.parentId = parentId;
        this.body = body;
        this.likeCount = 0;
    }
}
