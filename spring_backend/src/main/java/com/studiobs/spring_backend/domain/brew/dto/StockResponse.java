package com.studiobs.spring_backend.domain.brew.dto;

import com.studiobs.spring_backend.domain.brew.entity.BrewStoreStock;
import java.time.LocalDateTime;

public record StockResponse(
        Integer id,
        Integer categoryId,
        String stockName,
        int stockNum,
        Integer stockMinNum,
        int version,
        boolean lowStock,
        boolean soonLow,
        Integer daysOfStock,
        LocalDateTime updatedAt
) {
    public static StockResponse from(BrewStoreStock stock) {
        return from(stock, false, null);
    }

    public static StockResponse from(BrewStoreStock stock, boolean soonLow, Integer daysOfStock) {
        return new StockResponse(
                stock.getId(),
                stock.getCategoryId(),
                stock.getStockName(),
                stock.getStockNum(),
                stock.getStockMinNum(),
                stock.getVersion() == null ? 0 : stock.getVersion(),
                stock.isLowStock(),
                soonLow,
                daysOfStock,
                stock.getUpdatedAt()
        );
    }
}
