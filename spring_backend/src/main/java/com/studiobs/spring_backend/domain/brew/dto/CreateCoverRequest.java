package com.studiobs.spring_backend.domain.brew.dto;

import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.UUID;

public record CreateCoverRequest(
        /** COVER만 필수. EXTRA는 null */
        UUID originalUserId,
        /** OWNER COVER/EXTRA 지정 시 필수. 직원 EXTRA는 서버에서 본인으로 채움 */
        UUID coverUserId,
        @NotNull LocalDate workDate,
        @NotNull LocalTime startTime,
        @NotNull LocalTime endTime,
        /** COVER(대체) | EXTRA(추가). null이면 COVER */
        String shiftKind,
        String note
) {
}
