package com.studiobs.spring_backend.domain.brew.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;
import java.time.LocalDate;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "brew_store_stock_usage_days")
@IdClass(BrewStoreStockUsageDayId.class)
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class BrewStoreStockUsageDay {

    @Id
    @Column(name = "stock_id", nullable = false)
    private Integer stockId;

    @Id
    @Column(name = "used_on", nullable = false)
    private LocalDate usedOn;

    @Column(nullable = false)
    private int qty;

    public BrewStoreStockUsageDay(Integer stockId, LocalDate usedOn, int qty) {
        this.stockId = stockId;
        this.usedOn = usedOn;
        this.qty = qty;
    }

    public void add(int delta) {
        this.qty += delta;
    }

    public void subtract(int delta) {
        this.qty = Math.max(0, this.qty - delta);
    }
}
