package com.studiobs.spring_backend.domain.sranko.dto;

public record SrankoTryOnResponse(
        String resultImageUrl,
        boolean stub,
        /** slim | regular | loose; null when skipFit (appearance-only). */
        String fit,
        /** True when primary garment−body ≤ −4 cm; null when skipFit. */
        Boolean muchTooSmall,
        /** Deprecated: always null (fit-warp removed from try-on pipeline). */
        Boolean warpApplied,
        /**
         * True when Gemini single-call try-on produced the result image.
         * Legacy name kept for API compatibility (was Stage2).
         */
        Boolean stage2Applied
) {
}
