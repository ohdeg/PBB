package com.studiobs.spring_backend.domain.dieta.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDate;
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
@Table(name = "dieta_activity_logs")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class DietaActivityLog {

    @Id
    @GeneratedValue
    @UuidGenerator
    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(length = 36, updatable = false, nullable = false)
    private UUID id;

    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(name = "user_id", nullable = false, length = 36)
    private UUID userId;

    @Column(name = "logged_on", nullable = false)
    private LocalDate loggedOn;

    private Integer steps;

    @Column(name = "duration_min")
    private Integer durationMin;

    @Column(name = "activity_kcal")
    private Integer activityKcal;

    @Column(length = 255)
    private String note;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @Builder
    public DietaActivityLog(
            UUID userId,
            LocalDate loggedOn,
            Integer steps,
            Integer durationMin,
            Integer activityKcal,
            String note
    ) {
        this.userId = userId;
        this.loggedOn = loggedOn;
        this.steps = steps;
        this.durationMin = durationMin;
        this.activityKcal = activityKcal;
        this.note = note;
    }

    public void update(Integer steps, Integer durationMin, Integer activityKcal, String note) {
        this.steps = steps;
        this.durationMin = durationMin;
        this.activityKcal = activityKcal;
        this.note = note;
    }
}
