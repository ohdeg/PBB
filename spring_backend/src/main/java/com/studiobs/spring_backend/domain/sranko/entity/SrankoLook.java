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
@Table(name = "sranko_looks")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class SrankoLook {

    @Id
    @GeneratedValue
    @UuidGenerator
    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(length = 36, updatable = false, nullable = false)
    private UUID id;

    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(name = "user_id", nullable = false, length = 36)
    private UUID userId;

    @Column(nullable = false, length = 120)
    private String name;

    @Column(name = "image_url", nullable = false, length = 512)
    private String imageUrl;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "item_ids_json", nullable = false, columnDefinition = "json")
    private String itemIdsJson;

    @Column(nullable = false, length = 16)
    private String source;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @Builder
    public SrankoLook(
            UUID userId,
            String name,
            String imageUrl,
            String itemIdsJson,
            String source
    ) {
        this.userId = userId;
        this.name = name;
        this.imageUrl = imageUrl;
        this.itemIdsJson = itemIdsJson != null ? itemIdsJson : "[]";
        this.source = source;
    }
}
