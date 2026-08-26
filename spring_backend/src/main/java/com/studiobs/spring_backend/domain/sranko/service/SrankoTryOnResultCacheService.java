package com.studiobs.spring_backend.domain.sranko.service;

import com.studiobs.spring_backend.domain.sranko.config.SrankoTryOnProperties;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

/**
 * Caches final try-on R2 public URLs for the ephemeral TTL window so identical
 * garment + fit requests skip Gemini. Body-stage JPEG cache is separate.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SrankoTryOnResultCacheService {

    private static final String KEY_PREFIX = "sranko:tryon:result:";
    private static final String REV_PREFIX = "sranko:tryon:result:rev:";

    private final StringRedisTemplate stringRedisTemplate;
    private final SrankoTryOnProperties tryOnProperties;

    public Optional<String> get(String cacheKey) {
        if (!tryOnProperties.resultCacheEnabled() || cacheKey == null || cacheKey.isBlank()) {
            return Optional.empty();
        }
        try {
            String url = stringRedisTemplate.opsForValue().get(cacheKey);
            if (url == null || url.isBlank()) {
                return Optional.empty();
            }
            log.info("[SrankoTryOnResultCache] hit keySuffix={}", suffix(cacheKey));
            return Optional.of(url);
        } catch (Exception ex) {
            log.warn("[SrankoTryOnResultCache] get failed: {}", ex.getMessage());
            return Optional.empty();
        }
    }

    public void put(String cacheKey, String resultImageUrl) {
        if (!tryOnProperties.resultCacheEnabled()) {
            return;
        }
        if (cacheKey == null || cacheKey.isBlank() || resultImageUrl == null || resultImageUrl.isBlank()) {
            return;
        }
        Duration ttl = effectiveTtl();
        try {
            stringRedisTemplate.opsForValue().set(cacheKey, resultImageUrl, ttl);
            String revKey = REV_PREFIX + sha256Hex(resultImageUrl);
            stringRedisTemplate.opsForValue().set(revKey, cacheKey, ttl);
            log.info(
                    "[SrankoTryOnResultCache] put keySuffix={} ttl={}m",
                    suffix(cacheKey),
                    ttl.toMinutes()
            );
        } catch (Exception ex) {
            log.warn("[SrankoTryOnResultCache] put failed: {}", ex.getMessage());
        }
    }

    public void delete(String cacheKey) {
        if (cacheKey == null || cacheKey.isBlank()) {
            return;
        }
        try {
            String url = stringRedisTemplate.opsForValue().get(cacheKey);
            stringRedisTemplate.delete(cacheKey);
            if (url != null && !url.isBlank()) {
                stringRedisTemplate.delete(REV_PREFIX + sha256Hex(url));
            }
        } catch (Exception ex) {
            log.warn("[SrankoTryOnResultCache] delete failed: {}", ex.getMessage());
        }
    }

    /** Drop cache entry that pointed at a promoted/deleted try-on URL. */
    public void invalidateByUrl(String resultImageUrl) {
        if (!tryOnProperties.resultCacheEnabled()
                || resultImageUrl == null
                || resultImageUrl.isBlank()) {
            return;
        }
        try {
            String revKey = REV_PREFIX + sha256Hex(resultImageUrl);
            String cacheKey = stringRedisTemplate.opsForValue().get(revKey);
            if (cacheKey != null && !cacheKey.isBlank()) {
                stringRedisTemplate.delete(cacheKey);
            }
            stringRedisTemplate.delete(revKey);
            log.info("[SrankoTryOnResultCache] invalidated urlSuffix={}", suffix(resultImageUrl));
        } catch (Exception ex) {
            log.warn("[SrankoTryOnResultCache] invalidate failed: {}", ex.getMessage());
        }
    }

    public static String buildKey(
            UUID userId,
            String sex,
            String model,
            boolean skipFit,
            Map<String, String> bodyMeasurements,
            Map<String, String> fitByItemId,
            List<String> fitWires,
            List<String> garmentTokens
    ) {
        StringBuilder material = new StringBuilder();
        material.append(userId != null ? userId : "anon").append('|');
        material.append(sex != null ? sex : "M").append('|');
        material.append(model != null ? model : "").append('|');
        material.append(skipFit).append('|');
        appendSortedMap(material, bodyMeasurements);
        material.append('|');
        appendSortedMap(material, fitByItemId);
        material.append('|');
        if (fitWires != null) {
            for (String wire : fitWires) {
                material.append(wire != null ? wire : "").append(',');
            }
        }
        material.append('|');
        if (garmentTokens != null) {
            List<String> sorted = new ArrayList<>(garmentTokens);
            sorted.sort(Comparator.naturalOrder());
            for (String token : sorted) {
                material.append(token != null ? token : "").append(';');
            }
        }
        return KEY_PREFIX + sha256Hex(material.toString());
    }

    private Duration effectiveTtl() {
        Duration ttl = tryOnProperties.ephemeralTtl();
        if (ttl == null || ttl.isNegative() || ttl.isZero()) {
            return Duration.ofHours(1);
        }
        return ttl;
    }

    private static void appendSortedMap(StringBuilder out, Map<String, String> map) {
        if (map == null || map.isEmpty()) {
            return;
        }
        map.entrySet().stream()
                .sorted(Map.Entry.comparingByKey())
                .forEach(e -> out
                        .append(e.getKey())
                        .append('=')
                        .append(e.getValue() != null ? e.getValue() : "")
                        .append('&'));
    }

    private static String sha256Hex(String raw) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(raw.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (Exception ex) {
            return UUID.nameUUIDFromBytes(raw.getBytes(StandardCharsets.UTF_8))
                    .toString()
                    .replace("-", "");
        }
    }

    private static String suffix(String value) {
        if (value == null || value.length() < 12) {
            return value;
        }
        return value.substring(value.length() - 12);
    }
}
