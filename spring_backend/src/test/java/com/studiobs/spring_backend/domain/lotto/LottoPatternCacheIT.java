package com.studiobs.spring_backend.domain.lotto;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.studiobs.spring_backend.domain.lotto.dto.LottoPatternProfilesResponse;
import com.studiobs.spring_backend.domain.lotto.dto.UpsertLottoDrawRequest;
import com.studiobs.spring_backend.domain.lotto.entity.LottoDraw;
import com.studiobs.spring_backend.domain.lotto.repository.LottoDrawRepository;
import com.studiobs.spring_backend.domain.lotto.service.LottoPatternCacheService;
import com.studiobs.spring_backend.domain.lotto.service.LottoService;
import com.studiobs.spring_backend.support.AbstractIntegrationTest;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.test.web.servlet.MockMvc;

class LottoPatternCacheIT extends AbstractIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private StringRedisTemplate stringRedisTemplate;

    @Autowired
    private LottoPatternCacheService patternCacheService;

    @Autowired
    private LottoDrawRepository drawRepository;

    @Autowired
    private LottoService lottoService;

    @BeforeEach
    void clean() {
        stringRedisTemplate.delete(LottoPatternCacheService.CACHE_KEY);
        drawRepository.deleteAllInBatch();
    }

    @Test
    @DisplayName("getOrCompute는 Redis에 쓰고, 두 번째 호출은 캐시를 읽는다")
    void cachesInRedis_andReuses() {
        seedDraws();

        assertThat(stringRedisTemplate.hasKey(LottoPatternCacheService.CACHE_KEY)).isFalse();

        LottoPatternProfilesResponse first = patternCacheService.getOrCompute();
        assertThat(first.profiles()).isNotEmpty();
        assertThat(first.profiles()).containsKeys("all", "4");
        assertThat(stringRedisTemplate.hasKey(LottoPatternCacheService.CACHE_KEY)).isTrue();

        String cachedJson = stringRedisTemplate.opsForValue().get(LottoPatternCacheService.CACHE_KEY);
        assertThat(cachedJson).isNotBlank().contains("\"learnStrength\"");

        Long ttl = stringRedisTemplate.getExpire(LottoPatternCacheService.CACHE_KEY);
        assertThat(ttl).isNotNull().isPositive();

        // DB를 비워도 캐시가 있으면 이전 결과를 반환해야 한다
        drawRepository.deleteAllInBatch();
        LottoPatternProfilesResponse second = patternCacheService.getOrCompute();
        assertThat(second.profiles().keySet()).isEqualTo(first.profiles().keySet());
        assertThat(second.profiles().get("4").sampleSize())
                .isEqualTo(first.profiles().get("4").sampleSize());
    }

    @Test
    @DisplayName("invalidate 후 재계산하고, syncUpsert 커밋 후에도 캐시가 비워진다")
    void invalidateAndSyncUpsertClearsCache() {
        seedDraws();
        patternCacheService.getOrCompute();
        assertThat(stringRedisTemplate.hasKey(LottoPatternCacheService.CACHE_KEY)).isTrue();

        patternCacheService.invalidate();
        assertThat(stringRedisTemplate.hasKey(LottoPatternCacheService.CACHE_KEY)).isFalse();

        patternCacheService.getOrCompute();
        assertThat(stringRedisTemplate.hasKey(LottoPatternCacheService.CACHE_KEY)).isTrue();

        lottoService.syncUpsert(new UpsertLottoDrawRequest(
                99,
                List.of(1, 2, 3, 4, 5, 6),
                7,
                LocalDate.of(2026, 8, 1),
                1_000L,
                1));

        assertThat(stringRedisTemplate.hasKey(LottoPatternCacheService.CACHE_KEY)).isFalse();
    }

    @Test
    @DisplayName("GET /api/v1/lotto/pattern-profiles 는 공개이며 Redis에 캐시한다")
    void publicEndpointCaches() throws Exception {
        seedDraws();
        assertThat(stringRedisTemplate.hasKey(LottoPatternCacheService.CACHE_KEY)).isFalse();

        mockMvc.perform(get("/api/v1/lotto/pattern-profiles"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.profiles.all.learnStrength").value(0.7))
                .andExpect(jsonPath("$.profiles['4'].learnStrength").value(0.3));

        assertThat(stringRedisTemplate.hasKey(LottoPatternCacheService.CACHE_KEY)).isTrue();
    }

    private void seedDraws() {
        drawRepository.saveAll(List.of(
                LottoDraw.builder().round(1).mainNumbers("1,3,5,8,10,12").build(),
                LottoDraw.builder().round(2).mainNumbers("1,3,7,9,11,14").build(),
                LottoDraw.builder().round(3).mainNumbers("2,4,6,8,10,11").build(),
                LottoDraw.builder().round(4).mainNumbers("1,3,5,10,20,22").build()));
    }
}
