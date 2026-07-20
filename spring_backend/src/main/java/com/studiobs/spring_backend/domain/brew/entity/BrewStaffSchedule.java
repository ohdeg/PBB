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
@Table(name = "brew_staff_schedules")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class BrewStaffSchedule {

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

    @JdbcTypeCode(SqlTypes.TINYINT)
    @Column(name = "day_of_week", nullable = false)
    private int dayOfWeek;

    @Column(name = "start_time", nullable = false)
    private LocalTime startTime;

    @Column(name = "end_time", nullable = false)
    private LocalTime endTime;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @Builder
    public BrewStaffSchedule(
            UUID storeId,
            UUID userId,
            int dayOfWeek,
            LocalTime startTime,
            LocalTime endTime
    ) {
        this.storeId = storeId;
        this.userId = userId;
        this.dayOfWeek = dayOfWeek;
        this.startTime = startTime;
        this.endTime = endTime;
    }

    public void updateTimes(LocalTime startTime, LocalTime endTime) {
        this.startTime = startTime;
        this.endTime = endTime;
    }

    public boolean isOvernight() {
        return endTime.isBefore(startTime);
    }
}
