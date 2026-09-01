package com.studiobs.spring_backend.domain.brew.scheduler;

import com.studiobs.spring_backend.domain.brew.service.BrewService;
import java.time.Duration;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/** 서울 매시 정각: 마지막 슬롯이 끝난 예약 퇴사를 확정. */
@Slf4j
@Component
@RequiredArgsConstructor
public class VevenoLeaveFinalizeScheduler {

    static final String LOCK_KEY = "veveno:leave:finalize:lock";
    private static final Duration LOCK_TTL = Duration.ofMinutes(5);

    private final BrewService brewService;
    private final StringRedisTemplate stringRedisTemplate;

    @Scheduled(cron = "0 0 * * * *", zone = "Asia/Seoul")
    public void finalizeDueLeaves() {
        Boolean acquired = stringRedisTemplate.opsForValue()
                .setIfAbsent(LOCK_KEY, "1", LOCK_TTL);
        if (!Boolean.TRUE.equals(acquired)) {
            return;
        }
        try {
            int done = brewService.finalizeDueLeaves();
            if (done > 0) {
                log.info("[VevenoLeave] finalized {} subscription(s)", done);
            }
        } finally {
            stringRedisTemplate.delete(LOCK_KEY);
        }
    }
}
