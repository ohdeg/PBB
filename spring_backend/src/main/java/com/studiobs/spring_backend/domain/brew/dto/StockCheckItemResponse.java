package com.studiobs.spring_backend.domain.brew.dto;

public record StockCheckItemResponse(
        Integer id,
        Integer categoryId,
        String name,
        int qty,
        Integer stockMinNum,
        String unit,
        int version
) {
}
