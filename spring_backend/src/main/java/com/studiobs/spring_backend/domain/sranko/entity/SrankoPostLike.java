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
        name = "sranko_post_likes",
        uniqueConstraints = @UniqueConstraint(
                name = "uq_sranko_post_likes_post_user",
                columnNames = {"post_id", "user_id"}
        )
)
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class SrankoPostLike {

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
    @Column(name = "user_id", nullable = false, length = 36)
    private UUID userId;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @Builder
    public SrankoPostLike(UUID postId, UUID userId) {
        this.postId = postId;
        this.userId = userId;
    }
}
