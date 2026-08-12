package com.studiobs.spring_backend.domain.sranko.dto;

/**
 * One saved place for Sranko weather (home / work / favorite).
 */
public record SrankoPlaceDto(
        String id,
        String label,
        /** HOME | WORK | FAVORITE */
        String kind,
        double lat,
        double lon,
        /** Optional search query / region hint. */
        String query
) {
}
