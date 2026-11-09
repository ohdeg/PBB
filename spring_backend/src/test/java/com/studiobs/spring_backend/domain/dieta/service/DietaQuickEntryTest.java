package com.studiobs.spring_backend.domain.dieta.service;

import static org.assertj.core.api.Assertions.assertThat;
import com.studiobs.spring_backend.domain.dieta.dto.DietaActivityLogResponse;
import com.studiobs.spring_backend.domain.dieta.dto.gemini.DietaGeminiMealRequest.MealGroup;
import com.studiobs.spring_backend.domain.dieta.support.DietaIntakeSourceDocument.MacroTotals;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

class DietaQuickEntryTest {
    private static final LocalDate DAY=LocalDate.of(2026,11,9);
    private static final MacroTotals TOTAL=new MacroTotals(BigDecimal.TEN,BigDecimal.TEN,BigDecimal.ONE,89);
    private static final List<MealGroup> MEALS=List.of(new MealGroup("DINNER",List.of("밥")));
    private static final JsonMapper JSON=JsonMapper.builder().build();

    @Test void noAverageForMissingOrInconsistentBreakdown() {
        assertThat(DietaMealBreakdown.validated(MEALS,null,TOTAL)).isEmpty();
        var json=JSON.readTree("{\"DINNER\":{\"carbG\":10,\"proteinG\":10,\"fatG\":1,\"kcal\":90}}");
        assertThat(DietaMealBreakdown.validated(MEALS,json,TOTAL)).isEmpty();
    }
    @Test void validatedBreakdownAndPortionUsePerServingValues() {
        var json=JSON.readTree("{\"DINNER\":{\"carbG\":10,\"proteinG\":10,\"fatG\":1,\"kcal\":89}}");
        assertThat(DietaMealBreakdown.validated(MEALS,json,TOTAL)).containsKey("DINNER");
        assertThat(DietaEntryStore.scale(TOTAL,new BigDecimal("1.5")).kcal()).isEqualTo(134);
        assertThat(DietaEntryStore.scale(TOTAL,new BigDecimal("2")).kcal()).isEqualTo(178);
    }
    private DietaActivityLogResponse row(int age,Integer steps,Integer minutes,Set<String> estimated) {
        return new DietaActivityLogResponse(null,DAY.minusDays(age),steps,minutes,null,true,null,null,null,null,estimated,"v");
    }
    @Test void activityAveragesCountExplicitZeroAndExcludeFutureMissingAndEstimated() {
        var rows=List.of(row(0,100,null,Set.of()),row(1,0,null,Set.of()),row(2,9,10,Set.of()),
                row(28,21,null,Set.of()),row(29,100,null,Set.of()),row(3,800,20,Set.of("steps")));
        var result=DietaActivityHistory.suggestions(rows,DAY,"version");
        assertThat(result.averages()).containsOnlyKeys("steps");
        assertThat(result.averages().get("steps")).isEqualTo(new DietaActivityHistory.Average(10,3));
        assertThat(result.previous().steps()).isZero();
    }
}
