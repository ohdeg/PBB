package com.studiobs.spring_backend.domain.sranko.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "sranko.ml")
public record SrankoMlProperties(
        String baseUrl,
        Boolean enabled
) {
    public SrankoMlProperties {
        if (baseUrl == null || baseUrl.isBlank()) {
            baseUrl = "http://127.0.0.1:8000";
        }
        if (enabled == null) {
            enabled = true;
        }
    }

    public boolean isEnabled() {
        return Boolean.TRUE.equals(enabled);
    }
}
