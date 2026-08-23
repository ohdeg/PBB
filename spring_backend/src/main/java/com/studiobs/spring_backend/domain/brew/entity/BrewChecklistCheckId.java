package com.studiobs.spring_backend.domain.brew.entity;

import java.io.Serializable;
import java.util.Objects;
import java.util.UUID;

public class BrewChecklistCheckId implements Serializable {

    private UUID runId;
    private Integer itemId;

    public BrewChecklistCheckId() {
    }

    public BrewChecklistCheckId(UUID runId, Integer itemId) {
        this.runId = runId;
        this.itemId = itemId;
    }

    @Override
    public boolean equals(Object other) {
        if (this == other) {
            return true;
        }
        if (!(other instanceof BrewChecklistCheckId that)) {
            return false;
        }
        return Objects.equals(runId, that.runId) && Objects.equals(itemId, that.itemId);
    }

    @Override
    public int hashCode() {
        return Objects.hash(runId, itemId);
    }
}
