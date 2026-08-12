package com.studiobs.spring_backend.domain.sranko.dto;

import com.studiobs.spring_backend.domain.sranko.entity.SrankoPrefs;
import java.util.List;
import java.util.Map;

public record SrankoPrefsResponse(
        boolean tryOnConsent,
        /** M or F; null when unset (clients treat as M for mannequin). */
        String sex,
        Map<String, String> bodyMeasurements,
        List<SrankoPlaceDto> places
) {
    public static SrankoPrefsResponse from(
            SrankoPrefs prefs,
            Map<String, String> bodyMeasurements,
            List<SrankoPlaceDto> places
    ) {
        return new SrankoPrefsResponse(
                prefs.isTryOnConsent(),
                prefs.getSex(),
                bodyMeasurements != null ? bodyMeasurements : Map.of(),
                places != null ? places : List.of()
        );
    }

    public static SrankoPrefsResponse empty() {
        return new SrankoPrefsResponse(false, null, Map.of(), List.of());
    }
}
