package com.studiobs.spring_backend.domain.brew.support;

import com.studiobs.spring_backend.domain.brew.entity.BrewShiftCover;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

/** Due / cover-after-leave rules. Callers load last shift end and covers. */
public final class BrewLeaveFinalize {

    public enum CoverAction {
        CONVERT,
        DELETE,
        KEEP
    }

    private BrewLeaveFinalize() {
    }

    public static boolean isDue(LocalDate leaveDate, LocalDateTime now, LocalDateTime lastEndOrNull) {
        if (leaveDate == null || now == null) {
            return false;
        }
        if (!now.toLocalDate().isAfter(leaveDate)) {
            return false;
        }
        if (lastEndOrNull == null) {
            return true;
        }
        return !now.isBefore(lastEndOrNull);
    }

    public static CoverAction classifyAfterLeave(UUID leaverId, BrewShiftCover cover) {
        if (leaverId == null || cover == null) {
            return CoverAction.DELETE;
        }
        boolean original = leaverId.equals(cover.getOriginalUserId());
        boolean worker = leaverId.equals(cover.getCoverUserId());
        if (original && cover.getCoverUserId() != null) {
            return CoverAction.CONVERT;
        }
        if (original) {
            return CoverAction.DELETE;
        }
        if (worker && BrewShiftCover.STATUS_APPROVED.equals(cover.getStatus())) {
            return CoverAction.KEEP;
        }
        if (worker) {
            return CoverAction.DELETE;
        }
        return CoverAction.KEEP;
    }
}
