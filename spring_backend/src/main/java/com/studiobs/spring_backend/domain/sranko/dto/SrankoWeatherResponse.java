package com.studiobs.spring_backend.domain.sranko.dto;

import java.util.List;

/**
 * Current weather snapshot for Sranko, optionally with the next 12 hourly slots.
 * Fields other than {@code tempC} may be null when the client supplies a manual
 * temperature without coordinates ({@code hourly} empty).
 */
public record SrankoWeatherResponse(
        String condition,
        Integer conditionCode,
        Double tempC,
        Integer humidity,
        Double windKph,
        boolean cached,
        boolean manualTemp,
        List<SrankoWeatherHourlyItem> hourly
) {
    public static SrankoWeatherResponse manual(double tempC) {
        return new SrankoWeatherResponse(null, null, tempC, null, null, false, true, List.of());
    }
}
