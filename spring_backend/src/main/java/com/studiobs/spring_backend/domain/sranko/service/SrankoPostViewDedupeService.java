package com.studiobs.spring_backend.domain.sranko.service;

import java.time.Duration;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

/**
 * Dedupes post view increments: same viewerKey + post → at most once per TTL.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SrankoPostViewDedupeService {

    private static final String KEY_PREFIX = "sranko:post:view:";
    private static final Duration TTL = Duration.ofHours(24);

    private final StringRedisTemplate stringRedisTemplate;

    /**
     * @return true if this view should increment read_count
     */
    public boolean tryAcquire(UUID postId, String viewerKey) {
        if (postId == null || viewerKey == null || viewerKey.isBlank()) {
            return false;
        }
        String key = KEY_PREFIX + postId + ":" + viewerKey.trim();
        try {
            Boolean acquired = stringRedisTemplate.opsForValue().setIfAbsent(key, "1", TTL);
            return Boolean.TRUE.equals(acquired);
        } catch (Exception ex) {
            log.warn("[SrankoPostView] redis dedupe failed (skip increment): {}", ex.getMessage());
            return false;
        }
    }
}
