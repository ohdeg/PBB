package com.studiobs.spring_backend.domain.dieta.support;

import com.studiobs.spring_backend.domain.dieta.dto.gemini.DietaGeminiMealRequest;
import com.studiobs.spring_backend.domain.dieta.dto.gemini.DietaGeminiMealRequest.ActivityHint;
import com.studiobs.spring_backend.domain.dieta.dto.gemini.DietaGeminiMealRequest.GoalHint;
import com.studiobs.spring_backend.domain.dieta.dto.gemini.DietaGeminiMealRequest.Instructions;
import com.studiobs.spring_backend.domain.dieta.dto.gemini.DietaGeminiMealRequest.KnownRecipe;
import com.studiobs.spring_backend.domain.dieta.dto.gemini.DietaGeminiMealRequest.MealGroup;
import com.studiobs.spring_backend.domain.dieta.dto.meal.DietaMealQueueItemDto;
import com.studiobs.spring_backend.domain.dieta.entity.DietaActivityLog;
import com.studiobs.spring_backend.domain.dieta.entity.DietaProfile;
import com.studiobs.spring_backend.domain.dieta.entity.DietaRecipe;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

/** Builds schemaVersion:1 Gemini meal finalize request from queue + profile + activity. */
public final class DietaGeminiRequestBuilder {

    private static final List<String> MEAL_ORDER = List.of("BREAKFAST", "LUNCH", "DINNER", "SNACK");

    private DietaGeminiRequestBuilder() {
    }

    public static DietaGeminiMealRequest build(
            LocalDate loggedOn,
            List<DietaMealQueueItemDto> items,
            DietaProfile profile,
            DietaActivityLog activity,
            List<KnownRecipe> knownRecipes
    ) {
        GoalHint goalHint = new GoalHint(
                profile.getGoalType(),
                profile.getTdeeKcal(),
                profile.getDailyKcal(),
                profile.getTargetWeightKg());

        List<MealGroup> meals = new ArrayList<>();
        for (String mealType : MEAL_ORDER) {
            List<String> texts = items.stream()
                    .filter(i -> mealType.equals(i.mealType()))
                    .map(i -> i.text() == null ? "" : i.text().trim())
                    .filter(t -> !t.isEmpty())
                    .toList();
            if (!texts.isEmpty()) {
                meals.add(new MealGroup(mealType, texts));
            }
        }

        int steps = 0;
        int activeMinutes = 0;
        Integer activityKcal = null;
        if (activity != null) {
            steps = activity.getSteps() != null ? activity.getSteps() : 0;
            activeMinutes = activity.getDurationMin() != null ? activity.getDurationMin() : 0;
            // Only include user-entered burned kcal; never send 0 as a stand-in.
            if (activity.getActivityKcal() != null) {
                activityKcal = activity.getActivityKcal();
            }
        }

        return new DietaGeminiMealRequest(
                1,
                "ko-KR",
                loggedOn,
                goalHint,
                meals,
                knownRecipes == null ? List.of() : knownRecipes,
                new ActivityHint(steps, activeMinutes, activityKcal),
                Instructions.productDefaults());
    }

    /**
     * Single homemade recipe analysis — same macro instructions, no activity hint
     * (zeros + review flags off) so Gemini stays focused on the food.
     * {@code servings} is the batch size; macros must be returned per 1 serving.
     */
    public static DietaGeminiMealRequest buildRecipe(
            LocalDate loggedOn,
            String title,
            List<String> ingredients,
            String steps,
            BigDecimal servings,
            DietaProfile profile
    ) {
        GoalHint goalHint = new GoalHint(
                profile.getGoalType(),
                profile.getTdeeKcal(),
                profile.getDailyKcal(),
                profile.getTargetWeightKg());

        BigDecimal batch = servings == null || servings.compareTo(BigDecimal.ZERO) <= 0
                ? BigDecimal.ONE
                : servings;

        List<String> items = new ArrayList<>();
        items.add("레시피: " + title.trim());
        items.add("아래는 " + batch.stripTrailingZeros().toPlainString()
                + "인분 분량이다. 1인분당 탄단지·kcal를 반환하라.");
        for (String ingredient : ingredients) {
            if (ingredient == null) {
                continue;
            }
            String line = ingredient.trim();
            if (!line.isEmpty()) {
                items.add(line);
            }
        }
        if (steps != null && !steps.isBlank()) {
            items.add("만드는 법: " + steps.trim());
        }

        // Synthetic meal group label — not persisted; meal type is chosen at add-to-day.
        return new DietaGeminiMealRequest(
                1,
                "ko-KR",
                loggedOn,
                goalHint,
                List.of(new MealGroup("RECIPE", items)),
                List.of(),
                new ActivityHint(0, 0, null),
                Instructions.recipeDefaults(batch));
    }

    public static KnownRecipe toKnownRecipe(DietaRecipe recipe) {
        return new KnownRecipe(
                recipe.getTitle(),
                recipe.getKcal(),
                recipe.getCarbG(),
                recipe.getProteinG(),
                recipe.getFatG());
    }

    public static List<KnownRecipe> toKnownRecipes(List<DietaRecipe> recipes) {
        if (recipes == null || recipes.isEmpty()) {
            return List.of();
        }
        return recipes.stream().map(DietaGeminiRequestBuilder::toKnownRecipe).toList();
    }

    /** Snapshot JSON payload stored on intake (goal + meals + activity). */
    public static Snapshot snapshotOf(DietaGeminiMealRequest request) {
        return new Snapshot(request.goalHint(), request.meals(), request.activityHint());
    }

    public record Snapshot(
            GoalHint goalHint,
            List<MealGroup> meals,
            ActivityHint activityHint
    ) {
    }

    public static BigDecimal round1(double value) {
        return BigDecimal.valueOf(Math.round(value * 10.0) / 10.0);
    }
}
