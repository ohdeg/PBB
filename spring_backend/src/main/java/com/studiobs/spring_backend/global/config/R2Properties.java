package com.studiobs.spring_backend.global.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app.r2")
public record R2Properties(
        boolean enabled,
        String accountId,
        String bucket,
        String endpoint,
        String region,
        String accessKeyId,
        String secretAccessKey,
        String publicBaseUrl,
        String keyPrefix
) {
}
