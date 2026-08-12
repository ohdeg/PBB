package com.studiobs.spring_backend.domain.sranko.dto;

/** One hourly forecast slot (local place time from WeatherAPI). */
public record SrankoWeatherHourlyItem(
        String time,
        String condition,
        Integer conditionCode,
        Double tempC,
        Integer chanceOfRain
) {
}
