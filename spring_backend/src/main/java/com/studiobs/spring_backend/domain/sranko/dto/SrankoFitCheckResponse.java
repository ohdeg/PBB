package com.studiobs.spring_backend.domain.sranko.dto;

import java.util.List;

/**
 * Pre-try-on fit preview from prefs body + closet item measurements.
 *
 * @param fit           slim | regular | loose
 * @param muchTooSmall  primary garment−body delta ≤ −4 cm
 * @param skipStage2 Gemini Stage2 not applicable (SHOES, missing primary, tiny REGULAR Δ)
 * @param parts per-part comparisons for the FE fit-map (empty for SHOES / unknown slots)
 */
public record SrankoFitCheckResponse(
        String fit,
        boolean muchTooSmall,
        boolean skipStage2,
        List<Part> parts
) {

    /**
     * @param band small | ok | large | unknown (unknown → cm values are null)
     */
    public record Part(
            String key,
            Double bodyCm,
            Double garmentCm,
            Double deltaCm,
            String band
    ) {
    }
}
