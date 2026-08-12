package com.studiobs.spring_backend.domain.sranko.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "sranko.weather")
public record SrankoWeatherProperties(
        String apiKey,
        String baseUrl
) {
    public SrankoWeatherProperties {
        if (apiKey == null) {
            apiKey = "";
        }
        if (baseUrl == null || baseUrl.isBlank()) {
            baseUrl = "https://api.weatherapi.com";
        }
    }

    public boolean hasApiKey() {
        return apiKey != null && !apiKey.isBlank();
    }
}
