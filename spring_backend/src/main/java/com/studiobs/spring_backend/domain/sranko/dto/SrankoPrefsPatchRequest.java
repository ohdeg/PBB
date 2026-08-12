package com.studiobs.spring_backend.domain.sranko.dto;

import java.util.List;
import java.util.Map;

public record SrankoPrefsPatchRequest(
        Boolean tryOnConsent,
        /** M or F; omit to leave unchanged. Blank clears to null (male fallback). */
        String sex,
        Map<String, String> bodyMeasurements,
        /** When non-null, replaces the full saved-places list. */
        List<SrankoPlaceDto> places
) {
}
