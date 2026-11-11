package com.studiobs.spring_backend.domain.dieta.service;

import static org.assertj.core.api.Assertions.assertThat;
import com.studiobs.spring_backend.domain.dieta.dto.gemini.DietaGeminiMealRequest.MealGroup;
import com.studiobs.spring_backend.domain.dieta.support.DietaIntakeSourceDocument.MacroTotals;
import java.math.BigDecimal;
import java.util.*;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

class DietaFoodDetailsTest {
    private final JsonMapper mapper = JsonMapper.builder().build();
    private final List<MealGroup> meals = List.of(new MealGroup("LUNCH",List.of("밥과 달걀"),List.of("a")));
    private final Map<String,MacroTotals> totals = Map.of("LUNCH",new MacroTotals(BigDecimal.ONE,BigDecimal.ONE,BigDecimal.ZERO,10));
    private final String entry = """
        {"entryId":"a","items":[
         {"name":"밥","portion":"5g","estimatedPortion":false,"carbG":1,"proteinG":0,"fatG":0,"kcal":5},
         {"name":"달걀","portion":"5g","estimatedPortion":true,"carbG":0,"proteinG":1,"fatG":0,"kcal":5}]}
        """;
    @Test void preservesMultipleFoodsAndPortionProvenance() {
        var result = DietaFoodDetails.validated(meals,mapper.readTree("["+entry+"]"),totals);
        assertThat(result.entries().get("a")).hasSize(2);
        assertThat(result.entries().get("a").getLast().estimatedPortion()).isTrue();
        assertThat(mapper.readValue(mapper.writeValueAsString(result),DietaFoodDetails.class)).isEqualTo(result);
    }
    @Test void dropsInvalidDetailWithoutLosingTheParentTotal() {
        for (var invalid : List.of(entry+","+entry,entry.replace("\"a\"","\"other\""),
                entry.replace("\"kcal\":5","\"kcal\":9"),entry.replace("\"carbG\":1","\"carbG\":-1"),""))
            assertThat(DietaFoodDetails.validated(meals,mapper.readTree("["+invalid+"]"),totals).entries()).isEmpty();
    }
}
