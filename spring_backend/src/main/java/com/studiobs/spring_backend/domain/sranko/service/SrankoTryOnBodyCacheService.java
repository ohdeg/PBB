package com.studiobs.spring_backend.domain.sranko.service;

import com.studiobs.spring_backend.domain.sranko.config.SrankoTryOnProperties;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Duration;
import java.util.Base64;
import java.util.HexFormat;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

/**
 * Short-TTL cache of multi-pass try-on <em>body</em> stage JPEGs so accessory-only
 * re-runs (HAT/SHOES) can skip the expensive torso Gemini call.
 * Disabled when {@link SrankoTryOnProperties#bodyCacheEnabled()} is false.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SrankoTryOnBodyCacheService {

    private static final String KEY_PREFIX = "sranko:tryon:body:";
    private static final Duration TTL = Duration.ofMinutes(15);
    /** Skip Redis write if JPEG is larger than this (Base64 expands ~4/3). */
    private static final int MAX_JPEG_BYTES = 1_200_000;

    private final StringRedisTemplate stringRedisTemplate;
    private final SrankoTryOnProperties tryOnProperties;

    public Optional<byte[]> get(String cacheKey) {
        if (!tryOnProperties.bodyCacheEnabled()) {
            log.info("[SrankoTryOnBodyCache] cache disabled — skip get");
            return Optional.empty();
        }
        if (cacheKey == null || cacheKey.isBlank()) {
            return Optional.empty();
        }
        try {
            String b64 = stringRedisTemplate.opsForValue().get(cacheKey);
            if (b64 == null || b64.isBlank()) {
                return Optional.empty();
            }
            byte[] jpeg = Base64.getDecoder().decode(b64);
            if (jpeg.length == 0) {
                return Optional.empty();
            }
            log.info("[SrankoTryOnBodyCache] hit keySuffix={} jpegBytes={}", suffix(cacheKey), jpeg.length);
            return Optional.of(jpeg);
        } catch (Exception ex) {
            log.warn("[SrankoTryOnBodyCache] get failed: {}", ex.getMessage());
            return Optional.empty();
        }
    }

    public void put(String cacheKey, byte[] jpegBytes) {
        if (!tryOnProperties.bodyCacheEnabled()) {
            log.info("[SrankoTryOnBodyCache] cache disabled — skip put");
            return;
        }
        if (cacheKey == null || cacheKey.isBlank() || jpegBytes == null || jpegBytes.length == 0) {
            return;
        }
        if (jpegBytes.length > MAX_JPEG_BYTES) {
            log.info(
                    "[SrankoTryOnBodyCache] skip put (too large) keySuffix={} jpegBytes={}",
                    suffix(cacheKey),
                    jpegBytes.length
            );
            return;
        }
        try {
            stringRedisTemplate.opsForValue().set(
                    cacheKey,
                    Base64.getEncoder().encodeToString(jpegBytes),
                    TTL
            );
            log.info("[SrankoTryOnBodyCache] put keySuffix={} jpegBytes={}", suffix(cacheKey), jpegBytes.length);
        } catch (Exception ex) {
            log.warn("[SrankoTryOnBodyCache] put failed: {}", ex.getMessage());
        }
    }

    /**
     * Stable key for user + person source + body garments (id/url) + fit label + sex.
     */
    public static String buildKey(
            UUID userId,
            String personSource,
            List<String> bodyGarmentIds,
            String overallFit,
            String sex
    ) {
        StringBuilder material = new StringBuilder();
        material.append(userId != null ? userId : "anon").append('|');
        material.append(personSource != null ? personSource : "").append('|');
        material.append(overallFit != null ? overallFit : "regular").append('|');
        material.append(sex != null ? sex : "M").append('|');
        if (bodyGarmentIds != null) {
            for (String id : bodyGarmentIds) {
                material.append(id != null ? id : "").append(';');
            }
        }
        return KEY_PREFIX + sha256Hex(material.toString());
    }

    private static String sha256Hex(String raw) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(raw.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (Exception ex) {
            return UUID.nameUUIDFromBytes(raw.getBytes(StandardCharsets.UTF_8)).toString().replace("-", "");
        }
    }

    private static String suffix(String cacheKey) {
        if (cacheKey == null || cacheKey.length() < 12) {
            return cacheKey;
        }
        return cacheKey.substring(cacheKey.length() - 12);
    }
}
