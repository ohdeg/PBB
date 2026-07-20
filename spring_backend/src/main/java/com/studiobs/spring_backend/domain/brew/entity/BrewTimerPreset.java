package com.studiobs.spring_backend.domain.brew.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Lob;
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
@Table(name = "brew_timer_presets")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class BrewTimerPreset {

    public static final String SCOPE_PERSONAL = "PERSONAL";
    public static final String SCOPE_STORE = "STORE";

    @Id
    @GeneratedValue
    @UuidGenerator
    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(length = 36, updatable = false, nullable = false)
    private UUID id;

    @Column(nullable = false, length = 16)
    private String scope;

    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(name = "user_id", length = 36)
    private UUID userId;

    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(name = "store_id", length = 36)
    private UUID storeId;

    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(name = "created_by_user_id", nullable = false, length = 36)
    private UUID createdByUserId;

    @Column(nullable = false, length = 120)
    private String name;

    @Lob
    @Column(nullable = false, columnDefinition = "LONGTEXT")
    private String steps;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @Builder
    public BrewTimerPreset(
            String scope,
            UUID userId,
            UUID storeId,
            UUID createdByUserId,
            String name,
            String steps
    ) {
        this.scope = scope;
        this.userId = userId;
        this.storeId = storeId;
        this.createdByUserId = createdByUserId;
        this.name = name;
        this.steps = steps;
    }

    public void update(String name, String steps) {
        this.name = name;
        this.steps = steps;
    }
}
