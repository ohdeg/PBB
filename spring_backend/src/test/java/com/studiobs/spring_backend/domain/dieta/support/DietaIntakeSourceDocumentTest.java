package com.studiobs.spring_backend.domain.dieta.support;

import static org.assertj.core.api.Assertions.assertThat;

import com.studiobs.spring_backend.domain.dieta.dto.gemini.DietaGeminiMealRequest.KnownRecipe;
import com.studiobs.spring_backend.domain.dieta.support.DietaIntakeSourceDocument.MacroTotals;
import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.json.JsonMapper;

class DietaIntakeSourceDocumentTest {

    private final ObjectMapper objectMapper = JsonMapper.builder().build();

    @Test
    void combinedWithRecipeSum_sumsDbRecipesAndQueueWithoutDoubleCount() throws Exception {
        MacroTotals recipeSum = new MacroTotals(
                new BigDecimal("20.0"),
                new BigDecimal("25.0"),
                new BigDecimal("10.0"),
                270);
        DietaIntakeSourceDocument doc = DietaIntakeSourceDocument.empty()
                .withAppendedRecipeId("r1")
                .withQueueFinalize(
                        new DietaGeminiRequestBuilder.Snapshot(null, List.of(), null),
                        new MacroTotals(
                                new BigDecimal("40.0"),
                                new BigDecimal("15.0"),
                                new BigDecimal("5.0"),
                                265),
                        List.of("r1"),
                        List.of(new KnownRecipe(
                                "된장찌개",
                                270,
                                new BigDecimal("20.0"),
                                new BigDecimal("25.0"),
                                new BigDecimal("10.0"))));

        MacroTotals combined = doc.combinedWithRecipeSum(recipeSum);
        assertThat(combined.carbG()).isEqualByComparingTo("60.0");
        assertThat(combined.proteinG()).isEqualByComparingTo("40.0");
        assertThat(combined.fatG()).isEqualByComparingTo("15.0");
        assertThat(combined.kcal()).isEqualTo(535);
        assertThat(doc.recipeIds()).containsExactly("r1");
        assertThat(doc.knownRecipes()).hasSize(1);

        String json = doc.write(objectMapper);
        DietaIntakeSourceDocument roundTrip = DietaIntakeSourceDocument.parse(objectMapper, json);
        assertThat(roundTrip.recipeIds()).containsExactly("r1");
        assertThat(roundTrip.knownRecipes()).hasSize(1);
        assertThat(roundTrip.queueTotals().kcal()).isEqualTo(265);
        assertThat(roundTrip.combinedWithRecipeSum(recipeSum).kcal()).isEqualTo(535);
        assertThat(json).contains("recipeIds").contains("knownRecipes").doesNotContain("analyzedRecipes");
    }

    @Test
    void legacyAnalyzedRecipes_stillReadableForMigration() {
        String legacyJson = """
                {"analyzedRecipes":[{"recipeId":"r1","mealType":"DINNER","title":"된장찌개","ingredients":["된장 30g"],"carbG":20.0,"proteinG":25.0,"fatG":10.0,"kcal":270,"oneLineReview":"ok","analyzedAt":"2026-07-30T03:00:00Z"}]}
                """;
        DietaIntakeSourceDocument doc = DietaIntakeSourceDocument.parse(objectMapper, legacyJson);
        assertThat(doc.analyzedRecipes()).hasSize(1);
        assertThat(doc.legacyRecipeMacroSum().kcal()).isEqualTo(270);
        assertThat(doc.recipeIds()).isEmpty();
    }

    @Test
    void parse_blankOrInvalid_returnsEmpty() {
        assertThat(DietaIntakeSourceDocument.parse(objectMapper, null).recipeIds()).isEmpty();
        assertThat(DietaIntakeSourceDocument.parse(objectMapper, "{not-json").recipeIds()).isEmpty();
    }
}
