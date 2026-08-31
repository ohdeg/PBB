package com.studiobs.spring_backend.domain.brew.dto;

import com.studiobs.spring_backend.domain.brew.entity.BrewStore;
import com.studiobs.spring_backend.domain.brew.support.CallBellSettings;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

public record StoreResponse(
        UUID id,
        UUID ownerUserId,
        String name,
        boolean isPublic,
        /** owner에게만 노출. 그 외 null */
        String inviteCode,
        boolean owned,
        boolean subscribed,
        boolean canEditStock,
        boolean onDuty,
        boolean stockEditOffDuty,
        boolean stockUsageHint,
        /** 호출벨 멘트. 없으면 클라이언트 기본 문구 */
        String callBellPhrase,
        Double callBellRate,
        Double callBellPitch,
        /** 열람자 본인의 퇴사 예정일(마지막 근무일). 없으면 null */
        LocalDate leaveDate,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
    public static StoreResponse from(
            BrewStore store,
            UUID viewerUserId,
            boolean subscribed,
            boolean canEditStock,
            boolean onDuty,
            LocalDate leaveDate
    ) {
        boolean owned = viewerUserId != null && store.getOwnerUserId().equals(viewerUserId);
        CallBellSettings bell = CallBellSettings.parse(store.getCallBellPhrase());
        return new StoreResponse(
                store.getId(),
                store.getOwnerUserId(),
                store.getName(),
                store.isPublic(),
                owned ? store.getInviteCode() : null,
                owned,
                subscribed,
                owned || canEditStock,
                onDuty,
                store.isStockEditOffDuty(),
                store.isStockUsageHint(),
                bell.phrase(),
                bell.rate(),
                bell.pitch(),
                leaveDate,
                store.getCreatedAt(),
                store.getUpdatedAt()
        );
    }
}
