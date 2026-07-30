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
@Table(name = "dieta_body_logs")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class DietaBodyLog {

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

    @Column(name = "body_fat_mass_kg", precision = 5, scale = 2)
    private BigDecimal bodyFatMassKg;

    @Column(name = "skeletal_muscle_mass_kg", precision = 5, scale = 2)
    private BigDecimal skeletalMuscleMassKg;

    @Column(nullable = false)
    private boolean fasted;

    @Column(nullable = false, length = 16)
    private String source;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @Builder
    public DietaBodyLog(
            UUID userId,
            LocalDate loggedOn,
            BigDecimal weightKg,
            BigDecimal bodyFatMassKg,
            BigDecimal skeletalMuscleMassKg,
            boolean fasted,
            String source
    ) {
        this.userId = userId;
        this.loggedOn = loggedOn;
        this.weightKg = weightKg;
        this.bodyFatMassKg = bodyFatMassKg;
        this.skeletalMuscleMassKg = skeletalMuscleMassKg;
        this.fasted = fasted;
        this.source = source;
    }

    public void update(
            BigDecimal weightKg,
            BigDecimal bodyFatMassKg,
            BigDecimal skeletalMuscleMassKg,
            boolean fasted,
            String source
    ) {
        this.weightKg = weightKg;
        this.bodyFatMassKg = bodyFatMassKg;
        this.skeletalMuscleMassKg = skeletalMuscleMassKg;
        this.fasted = fasted;
        this.source = source;
    }
}
