package com.studiobs.spring_backend.global.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app.cookie")
public record CookieProperties(
        String refreshTokenName,
        boolean secure,
        String sameSite,
        String path
) {
}
