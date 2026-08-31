package com.studiobs.spring_backend.domain.brew.support;

import com.studiobs.spring_backend.global.exception.BusinessException;
import java.util.UUID;
import org.springframework.http.HttpStatus;

/** POS JWT 요청의 바인딩 스냅샷. JwtAuthenticationFilter가 넣고, 필터 finally에서 지운다. */
public final class PosAccess {

    public record Snapshot(UUID userId, UUID storeId, boolean canEditStock, String deviceId) {
    }

    private static final ThreadLocal<Snapshot> HOLDER = new ThreadLocal<>();

    private PosAccess() {
    }

    public static void set(Snapshot snapshot) {
        HOLDER.set(snapshot);
    }

    public static void clear() {
        HOLDER.remove();
    }

    public static boolean isPos() {
        return HOLDER.get() != null;
    }

    public static Snapshot require() {
        Snapshot snapshot = HOLDER.get();
        if (snapshot == null) {
            throw new BusinessException(HttpStatus.UNAUTHORIZED, "LOGIN_REQUIRED", "로그인이 필요합니다.");
        }
        return snapshot;
    }

    public static void forbidManagement() {
        if (isPos()) {
            throw new BusinessException(
                    HttpStatus.FORBIDDEN,
                    "POS_MANAGEMENT_FORBIDDEN",
                    "POS에서는 관리 기능을 사용할 수 없습니다.");
        }
    }

    public static void requireBoundStore(UUID storeId) {
        if (!isPos()) {
            return;
        }
        if (!require().storeId().equals(storeId)) {
            throw new BusinessException(
                    HttpStatus.FORBIDDEN,
                    "POS_STORE_MISMATCH",
                    "이 POS에 연결된 가게가 아닙니다.");
        }
    }
}
