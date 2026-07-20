package com.studiobs.spring_backend.domain.brew.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import java.util.UUID;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "brew_store_stock_categories")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class BrewStoreStockCategory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(name = "store_id", nullable = false, length = 36)
    private UUID storeId;

    @Column(name = "category_name", nullable = false, length = 255)
    private String categoryName;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @Builder
    public BrewStoreStockCategory(UUID storeId, String categoryName) {
        this.storeId = storeId;
        this.categoryName = categoryName;
    }

    public void rename(String categoryName) {
        this.categoryName = categoryName;
    }
}
