package com.studiobs.spring_backend.domain.dieta.support;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.studiobs.spring_backend.domain.dieta.dto.gemini.DietaGeminiMealRequest.ActivityHint;
import com.studiobs.spring_backend.domain.dieta.dto.gemini.DietaGeminiMealRequest.GoalHint;
import com.studiobs.spring_backend.domain.dieta.dto.gemini.DietaGeminiMealRequest.KnownRecipe;
import com.studiobs.spring_backend.domain.dieta.dto.gemini.DietaGeminiMealRequest.MealGroup;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.ObjectMapper;

/**
 * Durable shape stored in {@code dieta_intake_logs.source_meals_json}.
 * Daily totals = sum(DB recipes for day) + optional {@code queueTotals} from day finalize.
 * Prefer {@code recipeIds} + optional {@code knownRecipes} audit; {@code analyzedRecipes}
 * is legacy and still read for migration.
 */
@JsonInclude(JsonInclude.Include.NON_EMPTY)
public record DietaIntakeSourceDocument(
        GoalHint goalHint,
        List<MealGroup> meals,
        ActivityHint activityHint,
        MacroTotals queueTotals,
        List<String> recipeIds,
        List<KnownRecipe> knownRecipes,
        List<AnalyzedRecipe> analyzedRecipes
) {
    public DietaIntakeSourceDocument {
        meals = meals == null ? List.of() : List.copyOf(meals);
        recipeIds = recipeIds == null ? List.of() : List.copyOf(recipeIds);
        knownRecipes = knownRecipes == null ? List.of() : List.copyOf(knownRecipes);
        analyzedRecipes = analyzedRecipes == null ? List.of() : List.copyOf(analyzedRecipes);
    }

    public static DietaIntakeSourceDocument empty() {
        return new DietaIntakeSourceDocument(
                null, List.of(), null, null, List.of(), List.of(), List.of());
    }

    public static DietaIntakeSourceDocument parse(ObjectMapper objectMapper, String json) {
        if (json == null || json.isBlank()) {
            return empty();
        }
        try {
            DietaIntakeSourceDocument doc = objectMapper.readValue(json, DietaIntakeSourceDocument.class);
            return doc == null ? empty() : doc;
        } catch (RuntimeException ex) {
            return empty();
        }
    }

    public String write(ObjectMapper objectMapper) throws JacksonException {
        return objectMapper.writeValueAsString(this);
    }

    public DietaIntakeSourceDocument withAppendedRecipeId(String recipeId) {
        List<String> next = new ArrayList<>(recipeIds);
        next.add(recipeId);
        return new DietaIntakeSourceDocument(
                goalHint, meals, activityHint, queueTotals, next, knownRecipes, analyzedRecipes);
    }

    public DietaIntakeSourceDocument withQueueFinalize(
            DietaGeminiRequestBuilder.Snapshot snapshot,
            MacroTotals queue,
            List<String> dayRecipeIds,
            List<KnownRecipe> dayKnownRecipes
    ) {
        return new DietaIntakeSourceDocument(
                snapshot.goalHint(),
                snapshot.meals(),
                snapshot.activityHint(),
                queue,
                dayRecipeIds == null ? List.of() : List.copyOf(dayRecipeIds),
                dayKnownRecipes == null ? List.of() : List.copyOf(dayKnownRecipes),
                List.of());
    }

    /** Legacy fallback when DB recipes are empty but old JSON still has analyzedRecipes. */
    public MacroTotals legacyRecipeMacroSum() {
        BigDecimal carb = BigDecimal.ZERO;
        BigDecimal protein = BigDecimal.ZERO;
        BigDecimal fat = BigDecimal.ZERO;
        int kcal = 0;
        for (AnalyzedRecipe recipe : analyzedRecipes) {
            carb = carb.add(nullToZero(recipe.carbG()));
            protein = protein.add(nullToZero(recipe.proteinG()));
            fat = fat.add(nullToZero(recipe.fatG()));
            kcal += Math.max(recipe.kcal(), 0);
        }
        return new MacroTotals(
                DietaGeminiRequestBuilder.round1(carb.doubleValue()),
                DietaGeminiRequestBuilder.round1(protein.doubleValue()),
                DietaGeminiRequestBuilder.round1(fat.doubleValue()),
                kcal);
    }

    public MacroTotals combinedWithRecipeSum(MacroTotals recipeSum) {
        MacroTotals recipes = recipeSum == null ? MacroTotals.zero() : recipeSum;
        return recipes.plus(queueTotals == null ? MacroTotals.zero() : queueTotals);
    }

    private static BigDecimal nullToZero(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value;
    }

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record AnalyzedRecipe(
            String recipeId,
            String mealType,
            String title,
            List<String> ingredients,
            String steps,
            BigDecimal carbG,
            BigDecimal proteinG,
            BigDecimal fatG,
            int kcal,
            String oneLineReview,
            Instant analyzedAt
    ) {
        public AnalyzedRecipe {
            ingredients = ingredients == null ? List.of() : List.copyOf(ingredients);
        }
    }

    public record MacroTotals(
            BigDecimal carbG,
            BigDecimal proteinG,
            BigDecimal fatG,
            int kcal
    ) {
        public static MacroTotals zero() {
            return new MacroTotals(BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, 0);
        }

        public MacroTotals plus(MacroTotals other) {
            if (other == null) {
                return this;
            }
            return new MacroTotals(
                    DietaGeminiRequestBuilder.round1(
                            nullToZero(carbG).add(nullToZero(other.carbG())).doubleValue()),
                    DietaGeminiRequestBuilder.round1(
                            nullToZero(proteinG).add(nullToZero(other.proteinG())).doubleValue()),
                    DietaGeminiRequestBuilder.round1(
                            nullToZero(fatG).add(nullToZero(other.fatG())).doubleValue()),
                    Math.max(kcal, 0) + Math.max(other.kcal(), 0));
        }

        private static BigDecimal nullToZero(BigDecimal value) {
            return value == null ? BigDecimal.ZERO : value;
        }
    }
}
