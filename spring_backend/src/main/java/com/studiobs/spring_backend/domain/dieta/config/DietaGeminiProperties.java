package com.studiobs.spring_backend.domain.dieta.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "dieta.gemini")
public record DietaGeminiProperties(
        String apiKey,
        String baseUrl,
        String model
) {
    public DietaGeminiProperties {
        if (baseUrl == null || baseUrl.isBlank()) {
            baseUrl = "https://generativelanguage.googleapis.com";
        }
        if (model == null || model.isBlank()) {
            model = "gemini-2.0-flash";
        }
        if (apiKey == null) {
            apiKey = "";
        }
    }

    public boolean hasApiKey() {
        return apiKey != null && !apiKey.isBlank();
    }
}
