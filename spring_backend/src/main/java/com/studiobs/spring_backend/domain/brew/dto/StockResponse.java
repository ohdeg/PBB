package com.studiobs.spring_backend.domain.brew.dto;

import com.studiobs.spring_backend.domain.brew.entity.BrewStoreStock;
import java.time.LocalDateTime;

public record StockResponse(
        Integer id,
        Integer categoryId,
        String stockName,
        int stockNum,
        Integer stockMinNum,
        boolean lowStock,
        LocalDateTime updatedAt
) {
    public static StockResponse from(BrewStoreStock stock) {
        return new StockResponse(
                stock.getId(),
                stock.getCategoryId(),
                stock.getStockName(),
                stock.getStockNum(),
                stock.getStockMinNum(),
                stock.isLowStock(),
                stock.getUpdatedAt()
        );
    }
}
