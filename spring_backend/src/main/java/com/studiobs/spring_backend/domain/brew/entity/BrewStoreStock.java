package com.studiobs.spring_backend.domain.brew.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

@Entity
@Table(name = "brew_store_stocks")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class BrewStoreStock {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(name = "category_id", nullable = false)
    private Integer categoryId;

    @Column(name = "stock_name", nullable = false, length = 255)
    private String stockName;

    @Column(name = "stock_num", nullable = false)
    private int stockNum;

    @Column(name = "stock_min_num")
    private Integer stockMinNum;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @Builder
    public BrewStoreStock(Integer categoryId, String stockName, int stockNum, Integer stockMinNum) {
        this.categoryId = categoryId;
        this.stockName = stockName;
        this.stockNum = stockNum;
        this.stockMinNum = stockMinNum;
    }

    public void update(String stockName, int stockNum, Integer stockMinNum) {
        this.stockName = stockName;
        this.stockNum = stockNum;
        this.stockMinNum = stockMinNum;
    }

    public boolean isLowStock() {
        return stockMinNum != null && stockNum <= stockMinNum;
    }
}
