package com.studiobs.spring_backend.domain.brew.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import java.time.LocalTime;
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
@Table(name = "brew_checklist_templates")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class BrewChecklistTemplate {

    @Id
    @GeneratedValue
    @UuidGenerator
    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(length = 36, updatable = false, nullable = false)
    private UUID id;

    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(name = "store_id", nullable = false, length = 36)
    private UUID storeId;

    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(name = "owner_user_id", length = 36)
    private UUID ownerUserId;

    @Column(nullable = false, length = 120)
    private String title;

    @Column(name = "trigger_type", nullable = false, length = 16)
    private String triggerType;

    @Column(name = "trigger_time")
    private LocalTime triggerTime;

    @Column(name = "trigger_dows", length = 32)
    private String triggerDows;

    @Column(nullable = false, length = 16)
    private String audience;

    @Column(nullable = false)
    private boolean interrupt;

    @Column(nullable = false)
    private boolean enabled;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @Builder
    public BrewChecklistTemplate(
            UUID storeId,
            UUID ownerUserId,
            String title,
            String triggerType,
            LocalTime triggerTime,
            String triggerDows,
            String audience,
            boolean interrupt,
            boolean enabled,
            int sortOrder
    ) {
        this.storeId = storeId;
        this.ownerUserId = ownerUserId;
        this.title = title;
        this.triggerType = triggerType;
        this.triggerTime = triggerTime;
        this.triggerDows = triggerDows;
        this.audience = audience;
        this.interrupt = interrupt;
        this.enabled = enabled;
        this.sortOrder = sortOrder;
    }

    public boolean isPersonal() {
        return ownerUserId != null;
    }

    public void update(
            String title,
            String triggerType,
            LocalTime triggerTime,
            String triggerDows,
            String audience,
            boolean interrupt,
            boolean enabled
    ) {
        this.title = title;
        this.triggerType = triggerType;
        this.triggerTime = triggerTime;
        this.triggerDows = triggerDows;
        this.audience = audience;
        this.interrupt = interrupt;
        this.enabled = enabled;
    }
}
