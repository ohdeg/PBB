package com.studiobs.spring_backend.domain.sranko.dto;

/** WeatherAPI location search hit. */
public record SrankoPlaceSearchHit(
        String name,
        String region,
        String country,
        double lat,
        double lon
) {
}
