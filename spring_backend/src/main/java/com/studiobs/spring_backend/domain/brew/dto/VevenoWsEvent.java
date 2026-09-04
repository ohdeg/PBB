package com.studiobs.spring_backend.domain.brew.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.List;
import java.util.UUID;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record VevenoWsEvent(
        String topic,
        String kind,
        UUID storeId,
        String storeName,
        StockCheckResponse open,
        StockCheckResponse done,
        List<NoticeResponse> notices,
        NoticeResponse notice,
        UUID noticeId,
        List<VevenoWsStoreSnapshot> stores
) {
    public static VevenoWsEvent hello(List<VevenoWsStoreSnapshot> stores) {
        return new VevenoWsEvent("hello", "snapshot", null, null, null, null, null, null, null, stores);
    }

    public static VevenoWsEvent stockCheck(
            String kind,
            UUID storeId,
            String storeName,
            StockCheckResponse open,
            StockCheckResponse done
    ) {
        return new VevenoWsEvent(
                "stockCheck", kind, storeId, storeName, open, done, null, null, null, null);
    }

    public static VevenoWsEvent noticeCreated(UUID storeId, String storeName, NoticeResponse notice) {
        return new VevenoWsEvent(
                "notice", "created", storeId, storeName, null, null, null, notice, notice.id(), null);
    }

    public static VevenoWsEvent noticeUpdated(UUID storeId, String storeName, NoticeResponse notice) {
        return new VevenoWsEvent(
                "notice", "updated", storeId, storeName, null, null, null, notice, notice.id(), null);
    }

    public static VevenoWsEvent noticeDeleted(UUID storeId, String storeName, UUID noticeId) {
        return new VevenoWsEvent(
                "notice", "deleted", storeId, storeName, null, null, null, null, noticeId, null);
    }
}
