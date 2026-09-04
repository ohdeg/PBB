package com.studiobs.spring_backend.domain.brew.dto;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import java.util.List;

public record StockCheckRemoveRequest(
        @NotEmpty List<@NotNull Integer> removeStockIds
) {
}
