package com.studiobs.spring_backend.domain.sranko.config;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * Try-on pipeline toggles (body cache, ephemeral R2 TTL).
 */
@ConfigurationProperties(prefix = "sranko.try-on")
public record SrankoTryOnProperties(
        /** When false, multi-pass body JPEG Redis cache is skipped (get/put no-op). */
        boolean bodyCacheEnabled,
        /** How long try-on R2 objects live before scheduled deletion (default 1h). */
        @DefaultValue("1h") Duration ephemeralTtl,
        /** When false, Redis expiry index + scheduled R2 purge are no-ops. */
        @DefaultValue("true") boolean ephemeralCleanupEnabled
) {
}
