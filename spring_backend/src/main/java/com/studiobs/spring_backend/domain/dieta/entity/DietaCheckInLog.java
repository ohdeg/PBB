package com.studiobs.spring_backend.domain.dieta.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.LocalDate;
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
@Table(name = "dieta_check_in_logs")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class DietaCheckInLog {

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

    @Column(name = "weight_kg", precision = 5, scale = 2)
    private BigDecimal weightKg;

    @Column(name = "baseline_weight_kg", precision = 5, scale = 2)
    private BigDecimal baselineWeightKg;

    @Column(name = "weight_delta_kg", precision = 5, scale = 2)
    private BigDecimal weightDeltaKg;

    @Column(name = "keep_targets", nullable = false)
    private boolean keepTargets;

    @Column(name = "applied_daily_kcal", nullable = false)
    private int appliedDailyKcal;

    @Column(name = "applied_activity_extra_kcal", nullable = false)
    private int appliedActivityExtraKcal;

    @Column(name = "applied_weekly_target_kg", nullable = false, precision = 4, scale = 2)
    private BigDecimal appliedWeeklyTargetKg;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @Builder
    public DietaCheckInLog(
            UUID userId,
            LocalDate loggedOn,
            BigDecimal weightKg,
            BigDecimal baselineWeightKg,
            BigDecimal weightDeltaKg,
            boolean keepTargets,
            int appliedDailyKcal,
            int appliedActivityExtraKcal,
            BigDecimal appliedWeeklyTargetKg
    ) {
        this.userId = userId;
        this.loggedOn = loggedOn;
        this.weightKg = weightKg;
        this.baselineWeightKg = baselineWeightKg;
        this.weightDeltaKg = weightDeltaKg;
        this.keepTargets = keepTargets;
        this.appliedDailyKcal = appliedDailyKcal;
        this.appliedActivityExtraKcal = appliedActivityExtraKcal;
        this.appliedWeeklyTargetKg = appliedWeeklyTargetKg;
    }

    public void update(
            BigDecimal weightKg,
            BigDecimal baselineWeightKg,
            BigDecimal weightDeltaKg,
            boolean keepTargets,
            int appliedDailyKcal,
            int appliedActivityExtraKcal,
            BigDecimal appliedWeeklyTargetKg
    ) {
        this.weightKg = weightKg;
        this.baselineWeightKg = baselineWeightKg;
        this.weightDeltaKg = weightDeltaKg;
        this.keepTargets = keepTargets;
        this.appliedDailyKcal = appliedDailyKcal;
        this.appliedActivityExtraKcal = appliedActivityExtraKcal;
        this.appliedWeeklyTargetKg = appliedWeeklyTargetKg;
    }
}
