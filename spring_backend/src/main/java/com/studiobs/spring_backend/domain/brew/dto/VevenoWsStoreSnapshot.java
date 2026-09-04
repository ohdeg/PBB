package com.studiobs.spring_backend.domain.brew.dto;

import java.util.List;
import java.util.UUID;

public record VevenoWsStoreSnapshot(
        UUID storeId,
        String storeName,
        StockCheckResponse open,
        StockCheckResponse done,
        List<NoticeResponse> notices
) {
}
