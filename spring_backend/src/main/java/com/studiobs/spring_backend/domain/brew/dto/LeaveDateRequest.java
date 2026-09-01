package com.studiobs.spring_backend.domain.brew.dto;

import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;

public record LeaveDateRequest(
        /** 마지막 정규일. 잔여 슬롯이 끝나면 구독 해제 */
        @NotNull LocalDate leaveDate
) {
}
