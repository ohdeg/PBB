package com.studiobs.spring_backend.domain.dieta.dto;

public record DietaCheckInApplyResponse(
        DietaProfileResponse profile,
        DietaCheckInLogResponse checkIn,
        DietaWeekProposalResponse proposal
) {
}
