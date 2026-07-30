package com.studiobs.spring_backend.domain.dieta.dto.gemini;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/** Gemini meal finalize request — schemaVersion 1 product contract. */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record DietaGeminiMealRequest(
        int schemaVersion,
        String locale,
        LocalDate loggedOn,
        GoalHint goalHint,
        List<MealGroup> meals,
        List<KnownRecipe> knownRecipes,
        ActivityHint activityHint,
        Instructions instructions
) {
    public DietaGeminiMealRequest {
        meals = meals == null ? List.of() : List.copyOf(meals);
        knownRecipes = knownRecipes == null ? List.of() : List.copyOf(knownRecipes);
    }

    public record GoalHint(
            String goalType,
            int maintainKcal,
            int dailyKcalTarget,
            BigDecimal targetWeightKg
    ) {
    }

    public record MealGroup(
            String mealType,
            List<String> items
    ) {
    }

    /** Pre-analyzed homemade recipes for the day — macros already known; do not re-estimate. */
    public record KnownRecipe(
            String name,
            int kcal,
            BigDecimal carbG,
            BigDecimal proteinG,
            BigDecimal fatG
    ) {
    }

    /**
     * steps / activeMinutes always present.
     * activityKcal only when user entered burned kcal — omit when null (never fake 0).
     */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record ActivityHint(
            int steps,
            int activeMinutes,
            Integer activityKcal
    ) {
    }

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record Instructions(
            boolean needMacros,
            boolean needKcal,
            boolean needOneLineReview,
            boolean missingAmountAsOneServing,
            boolean includeActivityInReview,
            boolean estimateActivityKcalIfMissing,
            /** Homemade recipe: return macros/kcal per 1 serving, not the whole batch. */
            Boolean perServingOnly,
            /** Batch servings the ingredient list was written for. */
            BigDecimal servings
    ) {
        public static Instructions productDefaults() {
            return new Instructions(true, true, true, true, true, true, null, null);
        }

        /** Homemade recipe-only call: macros + one-line review, no activity tone; per-serving. */
        public static Instructions recipeDefaults(BigDecimal servings) {
            return new Instructions(true, true, true, true, false, false, true, servings);
        }
    }
}
