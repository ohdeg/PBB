package com.studiobs.spring_backend.domain.dieta.service;

import jakarta.annotation.PreDestroy;
import java.time.Clock;
import java.util.Set;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Bean;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
public class DietaAnalysisScheduler {
    private final DietaAnalysisStore store;
    private final DietaService service;
    private final Clock clock;
    private final Set<DietaAnalysisStore.Due> queued = ConcurrentHashMap.newKeySet();
    private final ThreadPoolExecutor workers = new ThreadPoolExecutor(4, 4, 0, TimeUnit.SECONDS,
            new ArrayBlockingQueue<>(60), Thread.ofPlatform().name("dieta-analysis-", 0).factory());

    @Bean
    static Clock dietaClock() { return Clock.systemUTC(); }

    @Scheduled(fixedDelay = 60000)
    public void dispatch() {
        for (var due : store.due(clock.instant())) {
            if (!queued.add(due)) continue;
            try {
                workers.execute(() -> {
                    try {
                        service.runDue(due);
                    } catch (RuntimeException ex) {
                        log.warn("Dieta scheduled analysis failed ({})", ex.getClass().getSimpleName());
                    } finally {
                        queued.remove(due);
                    }
                });
            } catch (RejectedExecutionException ex) {
                queued.remove(due); // Cursor remains due for the next poll.
                break;
            }
        }
    }

    @PreDestroy
    void shutdown() { workers.shutdownNow(); }
}
