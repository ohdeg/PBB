package com.studiobs.spring_backend.domain.sranko.scheduler;

import com.studiobs.spring_backend.domain.sranko.service.SrankoTryOnEphemeralService;
import java.time.Duration;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Periodically deletes expired try-on R2 objects tracked in Redis.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class SrankoTryOnEphemeralCleanupScheduler {

    private static final String LOCK_KEY = "sranko:tryon:expiry:lock";
    private static final Duration LOCK_TTL = Duration.ofSeconds(50);

    private final SrankoTryOnEphemeralService ephemeralService;
    private final StringRedisTemplate stringRedisTemplate;

    @Scheduled(fixedDelayString = "${sranko.try-on.ephemeral-cleanup-interval-ms:60000}")
    public void purgeExpiredTryOns() {
        Boolean acquired = stringRedisTemplate.opsForValue()
                .setIfAbsent(LOCK_KEY, "1", LOCK_TTL);
        if (!Boolean.TRUE.equals(acquired)) {
            return;
        }
        try {
            ephemeralService.purgeExpired();
        } finally {
            stringRedisTemplate.delete(LOCK_KEY);
        }
    }
}
