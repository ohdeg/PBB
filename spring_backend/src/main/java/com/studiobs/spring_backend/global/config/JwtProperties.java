package com.studiobs.spring_backend.global.config;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app.jwt")
public record JwtProperties(
        String secret,
        Duration accessTokenExpiry,
        Duration refreshTokenExpiry
) {
}
