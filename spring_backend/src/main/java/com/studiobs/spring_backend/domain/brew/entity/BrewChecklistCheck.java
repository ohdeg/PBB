package com.studiobs.spring_backend.domain.brew.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import java.util.UUID;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "brew_checklist_checks")
@IdClass(BrewChecklistCheckId.class)
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class BrewChecklistCheck {

    @Id
    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(name = "run_id", nullable = false, length = 36)
    private UUID runId;

    @Id
    @Column(name = "item_id", nullable = false)
    private Integer itemId;

    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(name = "user_id", nullable = false, length = 36)
    private UUID userId;

    @CreationTimestamp
    @Column(name = "checked_at", updatable = false)
    private LocalDateTime checkedAt;

    public BrewChecklistCheck(UUID runId, Integer itemId, UUID userId) {
        this.runId = runId;
        this.itemId = itemId;
        this.userId = userId;
    }
}
