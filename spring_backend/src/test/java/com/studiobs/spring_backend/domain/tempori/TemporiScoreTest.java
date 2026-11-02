package com.studiobs.spring_backend.domain.tempori;

import static org.junit.jupiter.api.Assertions.*;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class TemporiScoreTest {
    @Test void deletionWinsOverLateUploadCompletionAndLeasePreventsEarlyCleanup() {
        var now = Instant.parse("2026-11-01T00:00:00Z");
        var row = TemporiScore.reserve(UUID.randomUUID(), "request-1", "fingerprint", "Title", null, "score.xml", "musicxml", 42, "hash", now);
        row.requestDelete(now);
        assertFalse(row.ready(now));
        assertEquals(TemporiScore.State.DELETING, row.getState());
        assertFalse(row.canDelete(now.plusSeconds(30)));
        assertTrue(row.canDelete(now.plusSeconds(601)));
    }
    @Test void readyAndRetryHaveExplicitStateTransitions() {
        var now = Instant.now();
        var row = TemporiScore.reserve(UUID.randomUUID(), "request-1", "fingerprint", "Title", null, "score.xml", "musicxml", 42, "hash", now);
        row.failed(now);
        assertEquals(TemporiScore.State.FAILED, row.getState());
        row.retry(now.plusSeconds(601));
        assertTrue(row.ready(now.plusSeconds(602)));
        row.requestDelete(now.plusSeconds(603));
        assertTrue(row.canDelete(now.plusSeconds(603)));
    }
}
