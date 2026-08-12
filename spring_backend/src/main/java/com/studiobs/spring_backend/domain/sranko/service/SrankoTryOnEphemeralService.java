package com.studiobs.spring_backend.domain.sranko.service;

import com.studiobs.spring_backend.domain.sranko.config.SrankoTryOnProperties;
import com.studiobs.spring_backend.global.r2.R2StorageService;
import java.time.Duration;
import java.time.Instant;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

/**
 * Tracks ephemeral try-on R2 objects for TTL deletion.
 * Redis ZSET score = expiry epoch millis; member = object key.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SrankoTryOnEphemeralService {

    static final String EXPIRY_ZSET = "sranko:tryon:expiry";

    private final StringRedisTemplate stringRedisTemplate;
    private final SrankoTryOnProperties tryOnProperties;
    private final R2StorageService r2StorageService;

    public void schedule(String objectKey) {
        if (!tryOnProperties.ephemeralCleanupEnabled()) {
            return;
        }
        if (objectKey == null || objectKey.isBlank()) {
            return;
        }
        Duration ttl = tryOnProperties.ephemeralTtl();
        if (ttl == null || ttl.isNegative() || ttl.isZero()) {
            ttl = Duration.ofHours(1);
        }
        double expiresAt = Instant.now().plus(ttl).toEpochMilli();
        try {
            stringRedisTemplate.opsForZSet().add(EXPIRY_ZSET, objectKey, expiresAt);
            log.info(
                    "[SrankoTryOnEphemeral] scheduled keySuffix={} ttl={}m",
                    suffix(objectKey),
                    ttl.toMinutes()
            );
        } catch (Exception ex) {
            log.warn("[SrankoTryOnEphemeral] schedule failed: {}", ex.getMessage());
        }
    }

    public void cancel(String objectKey) {
        if (objectKey == null || objectKey.isBlank()) {
            return;
        }
        try {
            Long removed = stringRedisTemplate.opsForZSet().remove(EXPIRY_ZSET, objectKey);
            if (removed != null && removed > 0) {
                log.info("[SrankoTryOnEphemeral] cancelled keySuffix={}", suffix(objectKey));
            }
        } catch (Exception ex) {
            log.warn("[SrankoTryOnEphemeral] cancel failed: {}", ex.getMessage());
        }
    }

    /** Delete R2 objects whose expiry score ≤ now. Returns number deleted. */
    public int purgeExpired() {
        if (!tryOnProperties.ephemeralCleanupEnabled()) {
            return 0;
        }
        if (!r2StorageService.isEnabled()) {
            return 0;
        }
        double now = Instant.now().toEpochMilli();
        Set<String> expired;
        try {
            expired = stringRedisTemplate.opsForZSet().rangeByScore(EXPIRY_ZSET, 0, now);
        } catch (Exception ex) {
            log.warn("[SrankoTryOnEphemeral] rangeByScore failed: {}", ex.getMessage());
            return 0;
        }
        if (expired == null || expired.isEmpty()) {
            return 0;
        }
        int deleted = 0;
        for (String key : expired) {
            if (key == null || key.isBlank()) {
                continue;
            }
            try {
                r2StorageService.deleteByKey(key);
                stringRedisTemplate.opsForZSet().remove(EXPIRY_ZSET, key);
                deleted++;
            } catch (Exception ex) {
                log.warn(
                        "[SrankoTryOnEphemeral] purge failed keySuffix={}: {}",
                        suffix(key),
                        ex.getMessage()
                );
            }
        }
        if (deleted > 0) {
            log.info("[SrankoTryOnEphemeral] purged {} try-on object(s)", deleted);
        }
        return deleted;
    }

    private static String suffix(String objectKey) {
        if (objectKey == null || objectKey.length() < 16) {
            return objectKey;
        }
        return objectKey.substring(objectKey.length() - 16);
    }
}
