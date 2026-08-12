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
@Table(name = "sranko_posts")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class SrankoPost {

    @Id
    @GeneratedValue
    @UuidGenerator
    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(length = 36, updatable = false, nullable = false)
    private UUID id;

    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(name = "author_user_id", nullable = false, length = 36)
    private UUID authorUserId;

    @Column(nullable = false, length = 200)
    private String subject;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String content;

    @Column(name = "image_url", nullable = false, length = 512)
    private String imageUrl;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "image_urls", nullable = false, columnDefinition = "json")
    private String imageUrlsJson;

    @Column(name = "read_count", nullable = false)
    private int readCount;

    @Column(name = "like_count", nullable = false)
    private int likeCount;

    @Column(name = "comment_count", nullable = false)
    private int commentCount;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @Builder
    public SrankoPost(
            UUID authorUserId,
            String subject,
            String content,
            String imageUrl,
            String imageUrlsJson
    ) {
        this.authorUserId = authorUserId;
        this.subject = subject;
        this.content = content;
        this.imageUrl = imageUrl;
        this.imageUrlsJson = imageUrlsJson != null ? imageUrlsJson : "[]";
        this.readCount = 0;
        this.likeCount = 0;
        this.commentCount = 0;
    }
}
