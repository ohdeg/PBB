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
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.annotations.UuidGenerator;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "dieta_intake_logs")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class DietaIntakeLog {

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

    @Column(name = "carb_g", nullable = false, precision = 7, scale = 1)
    private BigDecimal carbG;

    @Column(name = "protein_g", nullable = false, precision = 7, scale = 1)
    private BigDecimal proteinG;

    @Column(name = "fat_g", nullable = false, precision = 7, scale = 1)
    private BigDecimal fatG;

    @Column(nullable = false)
    private int kcal;

    @Column(columnDefinition = "TEXT")
    private String review;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "source_meals_json", columnDefinition = "json")
    private String sourceMealsJson;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @Builder
    public DietaIntakeLog(
            UUID userId,
            LocalDate loggedOn,
            BigDecimal carbG,
            BigDecimal proteinG,
            BigDecimal fatG,
            int kcal,
            String review,
            String sourceMealsJson
    ) {
        this.userId = userId;
        this.loggedOn = loggedOn;
        this.carbG = carbG;
        this.proteinG = proteinG;
        this.fatG = fatG;
        this.kcal = kcal;
        this.review = review;
        this.sourceMealsJson = sourceMealsJson;
    }

    public void update(
            BigDecimal carbG,
            BigDecimal proteinG,
            BigDecimal fatG,
            int kcal,
            String review,
            String sourceMealsJson
    ) {
        this.carbG = carbG;
        this.proteinG = proteinG;
        this.fatG = fatG;
        this.kcal = kcal;
        this.review = review;
        this.sourceMealsJson = sourceMealsJson;
    }
}
