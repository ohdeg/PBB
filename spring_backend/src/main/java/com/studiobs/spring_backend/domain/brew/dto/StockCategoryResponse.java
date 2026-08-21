package com.studiobs.spring_backend.domain.brew.dto;

import com.studiobs.spring_backend.domain.brew.entity.BrewStoreStockCategory;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public record StockCategoryResponse(
        Integer id,
        UUID storeId,
        String categoryName,
        List<StockResponse> stocks,
        LocalDateTime createdAt
) {
    public static StockCategoryResponse from(
            BrewStoreStockCategory category,
            List<StockResponse> stocks
    ) {
        return new StockCategoryResponse(
                category.getId(),
                category.getStoreId(),
                category.getCategoryName(),
                stocks,
                category.getCreatedAt()
        );
    }
}
