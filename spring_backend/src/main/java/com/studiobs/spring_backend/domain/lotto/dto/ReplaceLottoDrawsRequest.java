package com.studiobs.spring_backend.domain.lotto.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import java.util.List;

public record ReplaceLottoDrawsRequest(
        @NotEmpty
        @Size(max = 3000)
        List<@Valid UpsertLottoDrawRequest> draws
) {
}
