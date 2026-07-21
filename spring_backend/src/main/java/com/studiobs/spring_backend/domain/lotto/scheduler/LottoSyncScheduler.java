package com.studiobs.spring_backend.domain.lotto.scheduler;

import com.studiobs.spring_backend.domain.lotto.client.DhLotteryClient;
import com.studiobs.spring_backend.domain.lotto.client.DhLotteryDrawResponse;
import com.studiobs.spring_backend.domain.lotto.dto.UpsertLottoDrawRequest;
import com.studiobs.spring_backend.domain.lotto.service.LottoService;
import java.time.Duration;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * 토요일 당첨번호 자동 동기화.
 * <p>추첨 결과 공개(21시경) 이후, 토 21:00~23:50 사이 10분 간격으로 최신 회차를
 * 조회해 저장한다. 저장에 성공하면 다음 틱에는 아직 미발표인 다음 회차만 남아
 * 자연히 no-op 되므로 별도 중지 플래그가 필요 없다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class LottoSyncScheduler {

    /** 한 틱에서 밀린 회차를 몰아서 채울 최대 개수(정상 운영 시 1). */
    private static final int MAX_CATCH_UP_PER_TICK = 10;
    private static final String LOCK_KEY = "lotto:sync:lock";
    private static final Duration LOCK_TTL = Duration.ofMinutes(5);

    private final DhLotteryClient dhLotteryClient;
    private final LottoService lottoService;
    private final StringRedisTemplate stringRedisTemplate;

    @Scheduled(cron = "0 0/10 21-23 * * SAT", zone = "Asia/Seoul")
    public void syncLatestDraws() {
        Boolean acquired = stringRedisTemplate.opsForValue()
                .setIfAbsent(LOCK_KEY, "1", LOCK_TTL);
        if (!Boolean.TRUE.equals(acquired)) {
            return;
        }

        try {
            int synced = 0;
            for (int attempt = 0; attempt < MAX_CATCH_UP_PER_TICK; attempt++) {
                int targetRound = lottoService.nextRoundToSync();
                Optional<DhLotteryDrawResponse> fetched =
                        dhLotteryClient.fetchDraw(targetRound);
                if (fetched.isEmpty()) {
                    break;
                }
                saveDraw(fetched.get());
                synced++;
                log.info("[LottoSync] {}회 저장 완료", targetRound);
            }
            if (synced == 0) {
                log.debug("[LottoSync] 새로 저장할 회차 없음");
            }
        } finally {
            stringRedisTemplate.delete(LOCK_KEY);
        }
    }

    private void saveDraw(DhLotteryDrawResponse res) {
        UpsertLottoDrawRequest request = new UpsertLottoDrawRequest(
                res.round(),
                res.mainNumbers(),
                res.bonusNumber(),
                parseDate(res.drawDate()),
                res.firstPrizeAmount(),
                res.firstPrizeWinnerCount());
        lottoService.syncUpsert(request);
    }

    private LocalDate parseDate(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        try {
            return LocalDate.parse(raw.trim());
        } catch (DateTimeParseException e) {
            return null;
        }
    }
}
