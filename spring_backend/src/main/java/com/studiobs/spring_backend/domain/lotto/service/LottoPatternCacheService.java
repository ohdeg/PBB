package com.studiobs.spring_backend.domain.lotto.service;

import com.studiobs.spring_backend.domain.lotto.dto.LottoPatternProfilesResponse;
import com.studiobs.spring_backend.domain.lotto.entity.LottoDraw;
import com.studiobs.spring_backend.domain.lotto.repository.LottoDrawRepository;
import java.time.Duration;
import java.util.List;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;

/**
 * 패턴 profile Redis 캐시.
 * 키 {@code lotto:pattern:profiles} — draws 변경 시 invalidate.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class LottoPatternCacheService {

    public static final String CACHE_KEY = "lotto:pattern:profiles";
    private static final Duration TTL = Duration.ofDays(7);

    private final StringRedisTemplate stringRedisTemplate;
    private final ObjectMapper objectMapper;
    private final LottoDrawRepository drawRepository;
    private final LottoPatternLearnService learnService;

    @Transactional(readOnly = true)
    public LottoPatternProfilesResponse getOrCompute() {
        try {
            String cached = stringRedisTemplate.opsForValue().get(CACHE_KEY);
            if (cached != null && !cached.isBlank()) {
                return objectMapper.readValue(cached, LottoPatternProfilesResponse.class);
            }
        } catch (Exception e) {
            log.warn("[LottoPattern] Redis 캐시 읽기 실패: {}", e.getMessage());
        }

        List<LottoDraw> draws = drawRepository.findAllByOrderByRoundAsc();
        LottoPatternProfilesResponse fresh = learnService.buildAll(draws);
        try {
            stringRedisTemplate.opsForValue().set(
                    CACHE_KEY,
                    objectMapper.writeValueAsString(fresh),
                    TTL);
        } catch (Exception e) {
            log.warn("[LottoPattern] Redis 캐시 쓰기 실패: {}", e.getMessage());
        }
        return fresh;
    }

    public void invalidate() {
        try {
            stringRedisTemplate.delete(CACHE_KEY);
        } catch (Exception e) {
            log.warn("[LottoPattern] Redis invalidate 실패: {}", e.getMessage());
        }
    }
}
