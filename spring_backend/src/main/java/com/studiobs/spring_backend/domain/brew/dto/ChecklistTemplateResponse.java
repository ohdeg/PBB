package com.studiobs.spring_backend.domain.brew.dto;

import com.studiobs.spring_backend.domain.brew.entity.BrewChecklistItem;
import com.studiobs.spring_backend.domain.brew.entity.BrewChecklistTemplate;
import java.time.LocalTime;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;

public record ChecklistTemplateResponse(
        UUID id,
        UUID storeId,
        boolean personal,
        String title,
        String triggerType,
        LocalTime triggerTime,
        List<Integer> triggerDows,
        String audience,
        boolean interrupt,
        boolean enabled,
        boolean canEdit,
        List<ChecklistItemResponse> items
) {
    public static ChecklistTemplateResponse from(
            BrewChecklistTemplate template,
            List<BrewChecklistItem> items,
            boolean canEdit
    ) {
        return new ChecklistTemplateResponse(
                template.getId(),
                template.getStoreId(),
                template.isPersonal(),
                template.getTitle(),
                template.getTriggerType(),
                template.getTriggerTime(),
                parseDows(template.getTriggerDows()),
                template.getAudience(),
                template.isInterrupt(),
                template.isEnabled(),
                canEdit,
                items.stream()
                        .map(item -> new ChecklistItemResponse(item.getId(), item.getBody()))
                        .toList()
        );
    }

    static List<Integer> parseDows(String raw) {
        if (raw == null || raw.isBlank()) {
            return List.of();
        }
        return Arrays.stream(raw.split(","))
                .map(String::trim)
                .filter(part -> !part.isEmpty())
                .map(Integer::parseInt)
                .toList();
    }
}
