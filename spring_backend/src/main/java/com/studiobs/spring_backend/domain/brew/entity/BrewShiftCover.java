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
@Table(name = "brew_shift_covers")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class BrewShiftCover {

    public static final String INITIATOR_EMPLOYEE = "EMPLOYEE";
    public static final String INITIATOR_OWNER = "OWNER";

    public static final String STATUS_PENDING_OWNER = "PENDING_OWNER";
    public static final String STATUS_PENDING_COVER = "PENDING_COVER";
    public static final String STATUS_APPROVED = "APPROVED";
    public static final String STATUS_REJECTED = "REJECTED";
    public static final String STATUS_CANCELLED = "CANCELLED";

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
    @Column(name = "original_user_id", nullable = false, length = 36)
    private UUID originalUserId;

    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(name = "cover_user_id", length = 36)
    private UUID coverUserId;

    @Column(name = "work_date", nullable = false)
    private LocalDate workDate;

    @Column(name = "start_time", nullable = false)
    private LocalTime startTime;

    @Column(name = "end_time", nullable = false)
    private LocalTime endTime;

    @Column(name = "initiator_type", nullable = false, length = 16)
    private String initiatorType;

    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(name = "requested_by_user_id", nullable = false, length = 36)
    private UUID requestedByUserId;

    @Column(nullable = false, length = 24)
    private String status;

    @Column(length = 500)
    private String note;

    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(name = "decided_by_user_id", length = 36)
    private UUID decidedByUserId;

    @Column(name = "decided_at")
    private LocalDateTime decidedAt;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @Builder
    public BrewShiftCover(
            UUID storeId,
            UUID originalUserId,
            UUID coverUserId,
            LocalDate workDate,
            LocalTime startTime,
            LocalTime endTime,
            String initiatorType,
            UUID requestedByUserId,
            String status,
            String note
    ) {
        this.storeId = storeId;
        this.originalUserId = originalUserId;
        this.coverUserId = coverUserId;
        this.workDate = workDate;
        this.startTime = startTime;
        this.endTime = endTime;
        this.initiatorType = initiatorType;
        this.requestedByUserId = requestedByUserId;
        this.status = status;
        this.note = note;
    }

    public boolean isOvernight() {
        return endTime.isBefore(startTime);
    }

    public void assignCoverUser(UUID coverUserId) {
        this.coverUserId = coverUserId;
        this.status = STATUS_PENDING_COVER;
    }

    public void decide(String status, UUID decidedByUserId) {
        this.status = status;
        this.decidedByUserId = decidedByUserId;
        this.decidedAt = LocalDateTime.now();
    }

    public void cancel(UUID decidedByUserId) {
        decide(STATUS_CANCELLED, decidedByUserId);
    }
}
