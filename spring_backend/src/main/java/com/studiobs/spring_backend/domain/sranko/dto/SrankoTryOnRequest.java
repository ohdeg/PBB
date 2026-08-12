package com.studiobs.spring_backend.domain.sranko.dto;

import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Virtual try-on request. Person is always the classpath mannequin from prefs {@code sex}.
 * <ul>
 *   <li>{@code itemIds} (preferred) — closet items; garment images loaded server-side</li>
 *   <li>legacy: {@code garmentImageUrl} + optional {@code itemId}</li>
 *   <li>{@code fitByItemId} — when body measurements missing: per-item slim|regular|loose</li>
 * </ul>
 */
public record SrankoTryOnRequest(
        @Size(max = 512) String garmentImageUrl,
        /** Optional closet item id (single-garment legacy). */
        UUID itemId,
        /** Multi-garment closet item ids (OUTER/TOP/BOTTOM/DRESS/HAT/SHOES, max 5). */
        List<UUID> itemIds,
        /**
         * Deprecated: prefer {@code fitByItemId} when body sizes are missing.
         * When true with no overrides, treated as regular fit (not appearance-only).
         */
        @Deprecated Boolean skipFit,
        /**
         * Optional per-closet-item fit override (UUID string → slim|regular|loose).
         * Used when the user has no body measurements.
         */
        Map<String, String> fitByItemId
) {
}
