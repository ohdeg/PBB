package com.studiobs.spring_backend.domain.brew.support;

import com.studiobs.spring_backend.global.exception.BusinessException;
import com.studiobs.spring_backend.global.r2.R2StorageService;
import java.util.UUID;
import org.springframework.http.HttpStatus;

public final class VevenoImageUrls {

    private VevenoImageUrls() {
    }

    public static String storePrefix(R2StorageService r2, UUID storeId) {
        return r2.keyPrefix() + "veveno/" + storeId + "/";
    }

    public static String requireOwnedUrl(R2StorageService r2, UUID storeId, String url) {
        String trimmed = url == null ? "" : url.trim();
        if (!R2StorageService.isHttpUrl(trimmed)) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "이미지 URL이 올바르지 않습니다.");
        }
        var key = r2.keyFromPublicUrl(trimmed);
        String expected = storePrefix(r2, storeId);
        if (key.isEmpty() || !key.get().startsWith(expected)) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "이 가게 이미지만 사용할 수 있습니다.");
        }
        return trimmed;
    }

    /** null incoming keeps current. Blank incoming clears. */
    public static String resolve(
            R2StorageService r2,
            UUID storeId,
            String incoming,
            String current
    ) {
        if (incoming == null) {
            return current;
        }
        if (incoming.isBlank()) {
            return null;
        }
        return requireOwnedUrl(r2, storeId, incoming);
    }

    public static void deleteIfReplaced(R2StorageService r2, String previous, String next) {
        if (previous != null && !previous.equals(next)) {
            r2.deleteByPublicUrl(previous);
        }
    }
}
