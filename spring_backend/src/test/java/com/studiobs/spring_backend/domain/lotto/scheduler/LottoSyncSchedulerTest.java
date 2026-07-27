package com.studiobs.spring_backend.domain.lotto.scheduler;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.studiobs.spring_backend.domain.lotto.client.DhLotteryClient;
import com.studiobs.spring_backend.domain.lotto.client.DhLotteryDrawResponse;
import com.studiobs.spring_backend.domain.lotto.dto.UpsertLottoDrawRequest;
import com.studiobs.spring_backend.domain.lotto.service.LottoService;
import java.time.Duration;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

@ExtendWith(MockitoExtension.class)
class LottoSyncSchedulerTest {

    @Mock
    private DhLotteryClient dhLotteryClient;
    @Mock
    private LottoService lottoService;
    @Mock
    private StringRedisTemplate stringRedisTemplate;
    @Mock
    private ValueOperations<String, String> valueOperations;

    private LottoSyncScheduler scheduler;

    @BeforeEach
    void setUp() {
        when(stringRedisTemplate.opsForValue()).thenReturn(valueOperations);
        scheduler = new LottoSyncScheduler(dhLotteryClient, lottoService, stringRedisTemplate);
    }

    @Test
    void syncLatestDraws_noOp_whenLockNotAcquired() {
        when(valueOperations.setIfAbsent(eq("lotto:sync:lock"), eq("1"), any(Duration.class)))
                .thenReturn(false);

        scheduler.syncLatestDraws();

        verify(lottoService, never()).nextRoundToSync();
        verify(dhLotteryClient, never()).fetchDraw(anyInt());
        verify(stringRedisTemplate, never()).delete(anyString());
    }

    @Test
    void syncLatestDraws_skipsUpsert_whenClientReturnsEmpty() {
        when(valueOperations.setIfAbsent(eq("lotto:sync:lock"), eq("1"), any(Duration.class)))
                .thenReturn(true);
        when(lottoService.nextRoundToSync()).thenReturn(1200);
        when(dhLotteryClient.fetchDraw(1200)).thenReturn(Optional.empty());

        scheduler.syncLatestDraws();

        verify(lottoService, never()).syncUpsert(any(UpsertLottoDrawRequest.class));
        verify(stringRedisTemplate).delete("lotto:sync:lock");
    }

    @Test
    void syncLatestDraws_upserts_whenDrawFetched() {
        when(valueOperations.setIfAbsent(eq("lotto:sync:lock"), eq("1"), any(Duration.class)))
                .thenReturn(true);
        when(lottoService.nextRoundToSync()).thenReturn(1200).thenReturn(1201);
        when(dhLotteryClient.fetchDraw(1200)).thenReturn(Optional.of(new DhLotteryDrawResponse(
                1200,
                List.of(1, 2, 3, 4, 5, 6),
                7,
                "2026-07-25",
                1_000_000_000L,
                3
        )));
        when(dhLotteryClient.fetchDraw(1201)).thenReturn(Optional.empty());

        scheduler.syncLatestDraws();

        verify(lottoService).syncUpsert(any(UpsertLottoDrawRequest.class));
        verify(stringRedisTemplate).delete("lotto:sync:lock");
    }
}
