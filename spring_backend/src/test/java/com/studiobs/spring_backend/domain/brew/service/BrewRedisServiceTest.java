package com.studiobs.spring_backend.domain.brew.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.studiobs.spring_backend.domain.brew.dto.BrewStatsResponse;
import java.time.Duration;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

@ExtendWith(MockitoExtension.class)
class BrewRedisServiceTest {

    @Mock
    private StringRedisTemplate stringRedisTemplate;

    @Mock
    private ValueOperations<String, String> valueOperations;

    private BrewRedisService service;

    @BeforeEach
    void setUp() {
        when(stringRedisTemplate.opsForValue()).thenReturn(valueOperations);
        service = new BrewRedisService(stringRedisTemplate);
    }

    @Test
    void getCachedStats_parsesOwnerAndStoreCount() {
        when(valueOperations.get(BrewRedisService.STATS_KEY)).thenReturn("3:12");

        assertThat(service.getCachedStats()).isEqualTo(new BrewStatsResponse(3, 12));
    }

    @Test
    void getCachedStats_returnsNull_whenMissingOrMalformed() {
        when(valueOperations.get(BrewRedisService.STATS_KEY)).thenReturn(null);
        assertThat(service.getCachedStats()).isNull();

        when(valueOperations.get(BrewRedisService.STATS_KEY)).thenReturn("not-a-pair");
        assertThat(service.getCachedStats()).isNull();
    }

    @Test
    void getCachedStats_returnsNull_whenRedisFails() {
        when(valueOperations.get(BrewRedisService.STATS_KEY))
                .thenThrow(new RuntimeException("redis down"));

        assertThat(service.getCachedStats()).isNull();
    }

    @Test
    void saveStats_writesColonPairWithOneHourTtl() {
        service.saveStats(new BrewStatsResponse(3, 12));

        verify(valueOperations).set(
                eq(BrewRedisService.STATS_KEY),
                eq("3:12"),
                eq(Duration.ofHours(1)));
    }

    @Test
    void saveStats_swallowsRedisErrors() {
        doThrow(new RuntimeException("redis down"))
                .when(valueOperations)
                .set(any(), any(), any(Duration.class));

        service.saveStats(new BrewStatsResponse(1, 1));

        verify(valueOperations).set(
                eq(BrewRedisService.STATS_KEY),
                eq("1:1"),
                eq(Duration.ofHours(1)));
    }
}
