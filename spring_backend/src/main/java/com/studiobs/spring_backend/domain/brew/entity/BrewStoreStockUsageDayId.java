package com.studiobs.spring_backend.domain.brew.entity;

import java.io.Serializable;
import java.time.LocalDate;
import java.util.Objects;

public class BrewStoreStockUsageDayId implements Serializable {

    private Integer stockId;
    private LocalDate usedOn;

    public BrewStoreStockUsageDayId() {
    }

    public BrewStoreStockUsageDayId(Integer stockId, LocalDate usedOn) {
        this.stockId = stockId;
        this.usedOn = usedOn;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (!(o instanceof BrewStoreStockUsageDayId that)) {
            return false;
        }
        return Objects.equals(stockId, that.stockId) && Objects.equals(usedOn, that.usedOn);
    }

    @Override
    public int hashCode() {
        return Objects.hash(stockId, usedOn);
    }
}
