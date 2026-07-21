package com.studiobs.spring_backend.domain.brew.dto;

import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;

public record LeaveDateRequest(
        /** 마지막 근무일. 이 날짜 다음날부터 구독 해제 */
        @NotNull LocalDate leaveDate
) {
}
