package com.studiobs.spring_backend.domain.brew.dto;

public record ChecklistTodayItemResponse(
        int id,
        String body,
        boolean checked,
        String checkedByNickname
) {
}
