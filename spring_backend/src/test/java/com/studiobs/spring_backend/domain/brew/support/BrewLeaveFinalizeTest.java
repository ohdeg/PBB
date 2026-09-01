package com.studiobs.spring_backend.domain.brew.support;

import static org.assertj.core.api.Assertions.assertThat;

import com.studiobs.spring_backend.domain.brew.entity.BrewShiftCover;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class BrewLeaveFinalizeTest {

    private static final LocalDate LEAVE = LocalDate.of(2026, 8, 31);

    @Test
    void due_whenNoShiftAndDayAfterLeave() {
        assertThat(BrewLeaveFinalize.isDue(
                LEAVE, LocalDateTime.of(2026, 9, 1, 0, 0), null)).isTrue();
    }

    @Test
    void notDue_onLeaveDate() {
        assertThat(BrewLeaveFinalize.isDue(
                LEAVE,
                LocalDateTime.of(2026, 8, 31, 23, 0),
                LocalDateTime.of(2026, 9, 1, 8, 0))).isFalse();
    }

    @Test
    void notDue_whileLastOvernightStillRunning() {
        LocalDateTime end = LocalDateTime.of(2026, 9, 1, 10, 0);
        assertThat(BrewLeaveFinalize.isDue(LEAVE, LocalDateTime.of(2026, 9, 1, 9, 0), end))
                .isFalse();
    }

    @Test
    void due_atExactLastEnd() {
        LocalDateTime end = LocalDateTime.of(2026, 9, 1, 10, 0);
        assertThat(BrewLeaveFinalize.isDue(LEAVE, end, end)).isTrue();
    }

    @Test
    void due_afterDayShiftEndedOnLeaveDate() {
        LocalDateTime end = LocalDateTime.of(2026, 8, 31, 18, 0);
        assertThat(BrewLeaveFinalize.isDue(
                LEAVE, LocalDateTime.of(2026, 9, 1, 0, 0), end)).isTrue();
    }

    @Test
    void classify_convertsCoverOfLeaverWhenWorkerAssigned() {
        UUID leaver = UUID.randomUUID();
        UUID other = UUID.randomUUID();
        assertThat(BrewLeaveFinalize.classifyAfterLeave(leaver, cover(
                leaver, other, BrewShiftCover.KIND_COVER, BrewShiftCover.STATUS_APPROVED)))
                .isEqualTo(BrewLeaveFinalize.CoverAction.CONVERT);
    }

    @Test
    void classify_deletesUnassignedCoverOfLeaver() {
        UUID leaver = UUID.randomUUID();
        assertThat(BrewLeaveFinalize.classifyAfterLeave(leaver, cover(
                leaver, null, BrewShiftCover.KIND_COVER, BrewShiftCover.STATUS_PENDING_OWNER)))
                .isEqualTo(BrewLeaveFinalize.CoverAction.DELETE);
    }

    @Test
    void classify_keepsApprovedWorkLeaverDoes() {
        UUID leaver = UUID.randomUUID();
        assertThat(BrewLeaveFinalize.classifyAfterLeave(leaver, cover(
                null, leaver, BrewShiftCover.KIND_EXTRA, BrewShiftCover.STATUS_APPROVED)))
                .isEqualTo(BrewLeaveFinalize.CoverAction.KEEP);
        assertThat(BrewLeaveFinalize.classifyAfterLeave(leaver, cover(
                UUID.randomUUID(), leaver, BrewShiftCover.KIND_COVER, BrewShiftCover.STATUS_APPROVED)))
                .isEqualTo(BrewLeaveFinalize.CoverAction.KEEP);
    }

    @Test
    void classify_deletesLeaverPendingOwnExtra() {
        UUID leaver = UUID.randomUUID();
        assertThat(BrewLeaveFinalize.classifyAfterLeave(leaver, cover(
                null, leaver, BrewShiftCover.KIND_EXTRA, BrewShiftCover.STATUS_PENDING_OWNER)))
                .isEqualTo(BrewLeaveFinalize.CoverAction.DELETE);
    }

    @Test
    void classify_keepsConvertedExtraWhenLeaverOnlyRequested() {
        UUID leaver = UUID.randomUUID();
        BrewShiftCover converted = cover(
                null, UUID.randomUUID(), BrewShiftCover.KIND_EXTRA, BrewShiftCover.STATUS_APPROVED);
        assertThat(BrewLeaveFinalize.classifyAfterLeave(leaver, converted))
                .isEqualTo(BrewLeaveFinalize.CoverAction.KEEP);
    }

    private static BrewShiftCover cover(
            UUID original,
            UUID worker,
            String kind,
            String status
    ) {
        return BrewShiftCover.builder()
                .storeId(UUID.randomUUID())
                .originalUserId(original)
                .coverUserId(worker)
                .workDate(LEAVE.plusDays(2))
                .startTime(LocalTime.of(9, 0))
                .endTime(LocalTime.of(18, 0))
                .shiftKind(kind)
                .initiatorType(BrewShiftCover.INITIATOR_OWNER)
                .requestedByUserId(UUID.randomUUID())
                .status(status)
                .build();
    }
}
