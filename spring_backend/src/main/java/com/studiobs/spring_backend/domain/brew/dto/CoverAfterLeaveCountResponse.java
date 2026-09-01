package com.studiobs.spring_backend.domain.brew.dto;

public record CoverAfterLeaveCountResponse(int count, int convert, int delete, int keep) {

    public static CoverAfterLeaveCountResponse of(int convert, int delete, int keep) {
        return new CoverAfterLeaveCountResponse(convert + delete + keep, convert, delete, keep);
    }
}
