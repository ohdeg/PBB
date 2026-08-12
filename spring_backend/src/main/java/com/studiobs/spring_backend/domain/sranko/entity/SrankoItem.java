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
@Table(name = "sranko_items")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class SrankoItem {

    @Id
    @GeneratedValue
    @UuidGenerator
    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(length = 36, updatable = false, nullable = false)
    private UUID id;

    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(name = "user_id", nullable = false, length = 36)
    private UUID userId;

    @Column(nullable = false, length = 16)
    private String slot;

    @Column(name = "category_code", nullable = false, length = 64)
    private String categoryCode;

    /** Warmth 1–5; null for shoes / unset. User-confirmed values are future training GT. */
    @JdbcTypeCode(SqlTypes.TINYINT)
    @Column
    private Integer warmth;

    @Column(nullable = false, length = 120)
    private String name;

    @Column(length = 80)
    private String brand;

    @Column(name = "product_url", length = 512)
    private String productUrl;

    @Column(name = "image_url", nullable = false, length = 512)
    private String imageUrl;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "measurements_json", nullable = false, columnDefinition = "json")
    private String measurementsJson;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @Builder
    public SrankoItem(
            UUID userId,
            String slot,
            String categoryCode,
            Integer warmth,
            String name,
            String brand,
            String productUrl,
            String imageUrl,
            String measurementsJson
    ) {
        this.userId = userId;
        this.slot = slot;
        this.categoryCode = categoryCode;
        this.warmth = warmth;
        this.name = name;
        this.brand = brand;
        this.productUrl = productUrl;
        this.imageUrl = imageUrl;
        this.measurementsJson = measurementsJson != null ? measurementsJson : "{}";
    }

    public void update(
            String slot,
            String categoryCode,
            Integer warmth,
            String name,
            String brand,
            String productUrl,
            String imageUrl,
            String measurementsJson
    ) {
        this.slot = slot;
        this.categoryCode = categoryCode;
        this.warmth = warmth;
        this.name = name;
        this.brand = brand;
        this.productUrl = productUrl;
        this.imageUrl = imageUrl;
        this.measurementsJson = measurementsJson != null ? measurementsJson : "{}";
    }
}
