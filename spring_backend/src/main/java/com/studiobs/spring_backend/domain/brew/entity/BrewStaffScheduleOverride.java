package com.studiobs.spring_backend.domain.brew.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDate;
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
@Table(name = "brew_staff_schedule_overrides")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class BrewStaffScheduleOverride {

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
    @Column(name = "user_id", nullable = false, length = 36)
    private UUID userId;

    @Column(name = "work_date", nullable = false)
    private LocalDate workDate;

    @Column(name = "start_time")
    private LocalTime startTime;

    @Column(name = "end_time")
    private LocalTime endTime;

    @Column(nullable = false)
    private boolean active;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @Builder
    public BrewStaffScheduleOverride(
            UUID storeId,
            UUID userId,
            LocalDate workDate,
            LocalTime startTime,
            LocalTime endTime,
            boolean active
    ) {
        this.storeId = storeId;
        this.userId = userId;
        this.workDate = workDate;
        this.startTime = startTime;
        this.endTime = endTime;
        this.active = active;
    }

    public void update(LocalTime startTime, LocalTime endTime, boolean active) {
        this.startTime = startTime;
        this.endTime = endTime;
        this.active = active;
    }

    public boolean isOvernight() {
        return startTime != null && endTime != null && endTime.isBefore(startTime);
    }
}
