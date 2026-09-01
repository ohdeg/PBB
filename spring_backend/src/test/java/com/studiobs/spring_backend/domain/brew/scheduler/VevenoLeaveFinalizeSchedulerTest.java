package com.studiobs.spring_backend.domain.brew.scheduler;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.studiobs.spring_backend.domain.brew.service.BrewService;
import java.time.Duration;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

@ExtendWith(MockitoExtension.class)
class VevenoLeaveFinalizeSchedulerTest {

    @Mock
    private BrewService brewService;
    @Mock
    private StringRedisTemplate stringRedisTemplate;
    @Mock
    private ValueOperations<String, String> valueOperations;

    private VevenoLeaveFinalizeScheduler scheduler;

    @BeforeEach
    void setUp() {
        when(stringRedisTemplate.opsForValue()).thenReturn(valueOperations);
        scheduler = new VevenoLeaveFinalizeScheduler(brewService, stringRedisTemplate);
    }

    @Test
    void skips_whenLockNotAcquired() {
        when(valueOperations.setIfAbsent(
                eq(VevenoLeaveFinalizeScheduler.LOCK_KEY), eq("1"), any(Duration.class)))
                .thenReturn(false);

        scheduler.finalizeDueLeaves();

        verify(brewService, never()).finalizeDueLeaves();
        verify(stringRedisTemplate, never()).delete(anyString());
    }

    @Test
    void runsAndReleasesLock() {
        when(valueOperations.setIfAbsent(
                eq(VevenoLeaveFinalizeScheduler.LOCK_KEY), eq("1"), any(Duration.class)))
                .thenReturn(true);
        when(brewService.finalizeDueLeaves()).thenReturn(2);

        scheduler.finalizeDueLeaves();

        verify(brewService).finalizeDueLeaves();
        verify(stringRedisTemplate).delete(VevenoLeaveFinalizeScheduler.LOCK_KEY);
    }
}
