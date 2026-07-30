package com.studiobs.spring_backend.domain.dieta.support;

import static org.assertj.core.api.Assertions.assertThat;

import com.studiobs.spring_backend.domain.dieta.dto.gemini.DietaGeminiMealRequest;
import com.studiobs.spring_backend.domain.dieta.dto.gemini.DietaGeminiMealRequest.KnownRecipe;
import com.studiobs.spring_backend.domain.dieta.dto.meal.DietaMealQueueItemDto;
import com.studiobs.spring_backend.domain.dieta.entity.DietaActivityLog;
import com.studiobs.spring_backend.domain.dieta.entity.DietaProfile;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.json.JsonMapper;

class DietaGeminiRequestBuilderTest {

    private final ObjectMapper objectMapper = JsonMapper.builder().build();

    @Test
    void activityKcal_omittedFromJson_whenNull() throws Exception {
        DietaProfile profile = sampleProfile();
        DietaActivityLog activity = DietaActivityLog.builder()
                .userId(profile.getUserId())
                .loggedOn(LocalDate.of(2026, 7, 29))
                .steps(5000)
                .durationMin(30)
                .activityKcal(null)
                .note(null)
                .build();

        DietaGeminiMealRequest request = DietaGeminiRequestBuilder.build(
                LocalDate.of(2026, 7, 29),
                List.of(new DietaMealQueueItemDto(
                        "1", "LUNCH", "닭가슴살 100g", Instant.parse("2026-07-29T12:00:00Z"))),
                profile,
                activity,
                List.of());

        assertThat(request.activityHint().activityKcal()).isNull();
        assertThat(request.activityHint().steps()).isEqualTo(5000);
        assertThat(request.activityHint().activeMinutes()).isEqualTo(30);

        String json = objectMapper.writeValueAsString(request);
        assertThat(json).doesNotContain("activityKcal");
        assertThat(json).contains("\"steps\":5000");
        assertThat(json).contains("\"activeMinutes\":30");
        assertThat(json).contains("\"estimateActivityKcalIfMissing\":true");
        assertThat(json).contains("\"missingAmountAsOneServing\":true");
    }

    @Test
    void activityKcal_includedWhenUserEntered() throws Exception {
        DietaProfile profile = sampleProfile();
        DietaActivityLog activity = DietaActivityLog.builder()
                .userId(profile.getUserId())
                .loggedOn(LocalDate.of(2026, 7, 29))
                .steps(0)
                .durationMin(0)
                .activityKcal(220)
                .note(null)
                .build();

        DietaGeminiMealRequest request = DietaGeminiRequestBuilder.build(
                LocalDate.of(2026, 7, 29),
                List.of(),
                profile,
                activity,
                List.of());

        assertThat(request.activityHint().activityKcal()).isEqualTo(220);
        String json = objectMapper.writeValueAsString(request);
        assertThat(json).contains("\"activityKcal\":220");
    }

    @Test
    void buildRecipe_omitsActivityTone_andUsesPerServingFlags() throws Exception {
        DietaProfile profile = sampleProfile();
        DietaGeminiMealRequest request = DietaGeminiRequestBuilder.buildRecipe(
                LocalDate.of(2026, 7, 30),
                "된장찌개",
                List.of("된장 30g", "두부 150g", "애호박 80g"),
                "끓여서 완성",
                new BigDecimal("4"),
                profile);

        assertThat(request.meals()).hasSize(1);
        assertThat(request.meals().getFirst().mealType()).isEqualTo("RECIPE");
        assertThat(request.meals().getFirst().items()).contains(
                "레시피: 된장찌개",
                "아래는 4인분 분량이다. 1인분당 탄단지·kcal를 반환하라.",
                "된장 30g",
                "두부 150g",
                "애호박 80g",
                "만드는 법: 끓여서 완성");
        assertThat(request.activityHint().steps()).isZero();
        assertThat(request.activityHint().activeMinutes()).isZero();
        assertThat(request.activityHint().activityKcal()).isNull();
        assertThat(request.instructions().missingAmountAsOneServing()).isTrue();
        assertThat(request.instructions().includeActivityInReview()).isFalse();
        assertThat(request.instructions().estimateActivityKcalIfMissing()).isFalse();
        assertThat(request.instructions().perServingOnly()).isTrue();
        assertThat(request.instructions().servings()).isEqualByComparingTo("4");

        String json = objectMapper.writeValueAsString(request);
        assertThat(json).doesNotContain("activityKcal");
        assertThat(json).contains("\"missingAmountAsOneServing\":true");
        assertThat(json).contains("\"includeActivityInReview\":false");
        assertThat(json).contains("\"perServingOnly\":true");
        assertThat(json).contains("\"servings\":4");
    }

    @Test
    void build_includesKnownRecipes_forDayFinalize() throws Exception {
        DietaProfile profile = sampleProfile();
        DietaGeminiMealRequest request = DietaGeminiRequestBuilder.build(
                LocalDate.of(2026, 7, 30),
                List.of(new DietaMealQueueItemDto(
                        "1", "LUNCH", "현미밥 한 공기", Instant.parse("2026-07-30T12:00:00Z"))),
                profile,
                null,
                List.of(new KnownRecipe(
                        "된장찌개",
                        270,
                        new BigDecimal("20.0"),
                        new BigDecimal("25.0"),
                        new BigDecimal("10.0"))));

        assertThat(request.knownRecipes()).hasSize(1);
        assertThat(request.knownRecipes().getFirst().name()).isEqualTo("된장찌개");
        assertThat(request.meals()).hasSize(1);
        assertThat(request.meals().getFirst().items()).containsExactly("현미밥 한 공기");

        String json = objectMapper.writeValueAsString(request);
        assertThat(json).contains("\"knownRecipes\"");
        assertThat(json).contains("\"name\":\"된장찌개\"");
        assertThat(json).contains("\"kcal\":270");
        assertThat(json).contains("\"carbG\":20.0");
        assertThat(json).contains("\"proteinG\":25.0");
        assertThat(json).contains("\"fatG\":10.0");
        assertThat(json).contains("현미밥");
    }

    private static DietaProfile sampleProfile() {
        return DietaProfile.builder()
                .userId(UUID.randomUUID())
                .heightCm(new BigDecimal("175.0"))
                .goalType("LOSS")
                .lastNonMaintainGoalType("LOSS")
                .weeklyTargetKg(new BigDecimal("0.50"))
                .targetWeightKg(new BigDecimal("70.00"))
                .weeklyEffectiveKg(new BigDecimal("0.450"))
                .weeklyBodyFatLossKg(new BigDecimal("0.450"))
                .weeklyMuscleGainKg(null)
                .intensityPreference(null)
                .bmrKcal(1700)
                .bmrSource("ESTIMATED")
                .activityFactor(new BigDecimal("1.40"))
                .tdeeKcal(2380)
                .dailyKcal(1980)
                .dietStyle("BALANCED")
                .macrosJson("{\"carbPct\":0.4,\"proteinPct\":0.3,\"fatPct\":0.3}")
                .macrosCustomized(false)
                .dietBaselineMethod("SURVEY")
                .lossInitialDeficitKcal(400)
                .gainInitialSurplusKcal(250)
                .lossCutKcal(175)
                .lossRecoverKcal(150)
                .lossActivityKcal(150)
                .gainSurplusKcal(250)
                .gainCutKcal(175)
                .gainCeilingDeltaKcal(500)
                .geminiMealConsent(true)
                .weekStartsOn(LocalDate.of(2026, 7, 23))
                .weekActivityExtraKcal(0)
                .onboardingComplete(true)
                .build();
    }
}
