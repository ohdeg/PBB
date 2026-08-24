package com.studiobs.spring_backend.domain.brew.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.studiobs.spring_backend.domain.brew.entity.BrewStoreStock;
import java.time.LocalDateTime;

public record StockResponse(
        Integer id,
        Integer categoryId,
        String stockName,
        int stockNum,
        Integer stockMinNum,
        String unit,
        @JsonInclude(JsonInclude.Include.NON_NULL)
        String orderUrl,
        int version,
        boolean lowStock,
        boolean soonLow,
        Integer daysOfStock,
        LocalDateTime updatedAt
) {
    public static StockResponse from(BrewStoreStock stock) {
        return from(stock, false, null, true);
    }

    public static StockResponse from(BrewStoreStock stock, boolean soonLow, Integer daysOfStock) {
        return from(stock, soonLow, daysOfStock, true);
    }

    public static StockResponse from(
            BrewStoreStock stock,
            boolean soonLow,
            Integer daysOfStock,
            boolean includeOrderUrl
    ) {
        return new StockResponse(
                stock.getId(),
                stock.getCategoryId(),
                stock.getStockName(),
                stock.getStockNum(),
                stock.getStockMinNum(),
                stock.getUnit() == null || stock.getUnit().isBlank() ? "개" : stock.getUnit(),
                includeOrderUrl ? stock.getOrderUrl() : null,
                stock.getVersion() == null ? 0 : stock.getVersion(),
                stock.isLowStock(),
                soonLow,
                daysOfStock,
                stock.getUpdatedAt()
        );
    }
}
