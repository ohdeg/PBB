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
@Table(name = "dieta_recipes")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class DietaRecipe {

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

    /** Null on create/library source; set on day copy via add-to-day. */
    @Column(name = "meal_type", length = 16)
    private String mealType;

    @Column(nullable = false, length = 200)
    private String title;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "ingredients_json", nullable = false, columnDefinition = "json")
    private String ingredientsJson;

    @Column(columnDefinition = "TEXT")
    private String steps;

    /** Per 1 serving. */
    @Column(name = "carb_g", nullable = false, precision = 7, scale = 1)
    private BigDecimal carbG;

    /** Per 1 serving. */
    @Column(name = "protein_g", nullable = false, precision = 7, scale = 1)
    private BigDecimal proteinG;

    /** Per 1 serving. */
    @Column(name = "fat_g", nullable = false, precision = 7, scale = 1)
    private BigDecimal fatG;

    /** Per 1 serving. */
    @Column(nullable = false)
    private int kcal;

    @Column(name = "one_line_review", columnDefinition = "TEXT")
    private String oneLineReview;

    /** Batch servings entered at create; macros/kcal are per 1 serving. */
    @Column(nullable = false, precision = 6, scale = 2)
    private BigDecimal servings;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @Builder
    public DietaRecipe(
            UUID userId,
            LocalDate loggedOn,
            String mealType,
            String title,
            String ingredientsJson,
            String steps,
            BigDecimal carbG,
            BigDecimal proteinG,
            BigDecimal fatG,
            int kcal,
            String oneLineReview,
            BigDecimal servings
    ) {
        this.userId = userId;
        this.loggedOn = loggedOn;
        this.mealType = mealType;
        this.title = title;
        this.ingredientsJson = ingredientsJson;
        this.steps = steps;
        this.carbG = carbG;
        this.proteinG = proteinG;
        this.fatG = fatG;
        this.kcal = kcal;
        this.oneLineReview = oneLineReview;
        this.servings = servings == null ? BigDecimal.ONE : servings;
    }
}
