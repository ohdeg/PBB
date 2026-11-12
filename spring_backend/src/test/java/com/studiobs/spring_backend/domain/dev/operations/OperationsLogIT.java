package com.studiobs.spring_backend.domain.dev.operations;

import com.studiobs.spring_backend.support.AbstractIntegrationTest;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;
import static org.assertj.core.api.Assertions.assertThat;

class OperationsLogIT extends AbstractIntegrationTest {
    @Autowired OperationsLog events;

    @Test @Transactional
    void groupsSameDayWithoutOverwritingLatestRequestWithAnOlderOne() {
        var now = Instant.now();
        var midnight = OperationsLog.day(now).atStartOfDay(java.time.ZoneId.of("Asia/Seoul")).toInstant();
        var latest = UUID.randomUUID().toString();
        events.error("Tempori", "fixtureOperation", 503, midnight.minusMillis(1), "yesterday");
        events.error("Tempori", "fixtureOperation", 503, now, latest);
        events.error("Tempori", "fixtureOperation", 503, midnight, "first");
        assertThat(events.today(null).errors()).filteredOn(e -> e.operation().equals("fixtureOperation"))
                .singleElement().satisfies(e -> {
                    assertThat(e.count()).isEqualTo(2);
                    assertThat(e.requestId()).isEqualTo(latest);
                });
    }
}
