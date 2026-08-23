package com.studiobs.spring_backend.domain.brew.dto;

import java.util.List;
import java.util.UUID;

public record ChecklistTodayResponse(
        UUID templateId,
        String title,
        boolean personal,
        boolean interrupt,
        boolean due,
        String triggerType,
        int checkedCount,
        int totalCount,
        List<ChecklistTodayItemResponse> items
) {
}
