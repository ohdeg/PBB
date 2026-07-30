package com.studiobs.spring_backend.domain.dieta;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.studiobs.spring_backend.domain.auth.consent.ConsentCatalog;
import com.studiobs.spring_backend.support.AbstractIntegrationTest;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

class DietaPhase5RecipeIT extends AbstractIntegrationTest {

    private static final String PASSWORD = "Passw0rd!";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private StringRedisTemplate stringRedisTemplate;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Test
    void analyzeRecipe_requiresConsent_thenMergesWithQueueFinalize() throws Exception {
        String email = "dieta5_" + System.nanoTime() + "@example.com";
        String nickname = "dieta5" + (System.nanoTime() % 1_000_000);
        String accessToken = signupAndLogin(email, nickname);

        mockMvc.perform(post("/api/v1/dieta/onboarding")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(onboardingJson(true)))
                .andExpect(status().isCreated());

        LocalDate today = LocalDate.now();

        mockMvc.perform(patch("/api/v1/dieta/profile")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"geminiMealConsent\":false}"))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/v1/dieta/recipes/analyze")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(recipeJson(today)))
                .andExpect(status().isForbidden());

        mockMvc.perform(patch("/api/v1/dieta/profile")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"geminiMealConsent\":true}"))
                .andExpect(status().isOk());

        MvcResult recipeResult = mockMvc.perform(post("/api/v1/dieta/recipes/analyze")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(recipeJson(today)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.recipeId").isNotEmpty())
                .andExpect(jsonPath("$.kcal").isNumber())
                .andExpect(jsonPath("$.carbG").isNumber())
                .andExpect(jsonPath("$.proteinG").isNumber())
                .andExpect(jsonPath("$.fatG").isNumber())
                .andExpect(jsonPath("$.servings").value(4.0))
                .andExpect(jsonPath("$.intake.loggedOn").value(today.toString()))
                .andExpect(jsonPath("$.intake.sourceMealsJson").isNotEmpty())
                .andReturn();

        JsonNode recipeBody = objectMapper.readTree(recipeResult.getResponse().getContentAsString());
        int recipeKcal = recipeBody.path("kcal").asInt();
        int intakeAfterRecipe = recipeBody.path("intake").path("kcal").asInt();
        assertThat(intakeAfterRecipe).isEqualTo(recipeKcal);
        assertThat(recipeBody.path("intake").path("sourceMealsJson").asString())
                .contains("recipeIds")
                .doesNotContain("analyzedRecipes");

        String recipeId = recipeBody.path("recipeId").asString();

        MvcResult listResult = mockMvc.perform(get("/api/v1/dieta/recipes")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .param("loggedOn", today.toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].id").value(recipeId))
                .andExpect(jsonPath("$[0].title").value("된장찌개"))
                .andExpect(jsonPath("$[0].servings").value(4.0))
                .andExpect(jsonPath("$[0].kcal").value(recipeKcal))
                .andReturn();

        JsonNode listed = objectMapper.readTree(listResult.getResponse().getContentAsString());
        assertThat(listed.get(0).path("mealType").isNull() || listed.get(0).path("mealType").isMissingNode())
                .isTrue();

        // Recipe must NOT appear in Redis meal queue
        mockMvc.perform(get("/api/v1/dieta/meal-queue")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .param("loggedOn", today.toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items").isEmpty())
                .andExpect(jsonPath("$.status").value("open"));

        mockMvc.perform(post("/api/v1/dieta/meal-queue/items")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"loggedOn":"%s","mealType":"LUNCH","text":"현미밥 한 공기"}
                                """.formatted(today)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items.length()").value(1));

        MvcResult finalizeResult = mockMvc.perform(post("/api/v1/dieta/meal-queue/finalize")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"loggedOn\":\"" + today + "\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.queue.status").value("done"))
                .andExpect(jsonPath("$.intake.kcal").isNumber())
                .andExpect(jsonPath("$.intake.sourceMealsJson").isNotEmpty())
                .andReturn();

        JsonNode finalizeBody = objectMapper.readTree(finalizeResult.getResponse().getContentAsString());
        int mergedKcal = finalizeBody.path("intake").path("kcal").asInt();
        String sourceJson = finalizeBody.path("intake").path("sourceMealsJson").asString();
        assertThat(mergedKcal).isGreaterThan(recipeKcal);
        assertThat(sourceJson)
                .contains("knownRecipes")
                .contains("queueTotals")
                .contains("된장찌개")
                .contains("현미밥")
                .contains("recipeIds");
        assertThat(finalizeBody.path("intake").path("review").asString()).contains("레시피");

        JsonNode source = objectMapper.readTree(sourceJson);
        assertThat(source.path("knownRecipes").isArray()).isTrue();
        assertThat(source.path("knownRecipes").size()).isEqualTo(1);
        assertThat(source.path("knownRecipes").get(0).path("name").asString()).isEqualTo("된장찌개");
        assertThat(source.path("knownRecipes").get(0).path("kcal").asInt()).isEqualTo(recipeKcal);
        assertThat(source.path("meals").toString()).contains("현미밥");
        assertThat(source.path("meals").toString()).doesNotContain("된장찌개");

        mockMvc.perform(get("/api/v1/dieta/intakes")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .param("loggedOn", today.toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].kcal").value(mergedKcal));
    }

    @Test
    void listRecipes_withoutLoggedOn_returnsAllNewestFirst() throws Exception {
        String email = "dieta5list_" + System.nanoTime() + "@example.com";
        String nickname = "dieta5l" + (System.nanoTime() % 1_000_000);
        String accessToken = signupAndLogin(email, nickname);

        mockMvc.perform(post("/api/v1/dieta/onboarding")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(onboardingJson(true)))
                .andExpect(status().isCreated());

        LocalDate day1 = LocalDate.now().minusDays(1);
        LocalDate day2 = LocalDate.now();

        MvcResult older = mockMvc.perform(post("/api/v1/dieta/recipes/analyze")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(recipeJson(day1, "된장찌개")))
                .andExpect(status().isOk())
                .andReturn();

        String olderId = objectMapper
                .readTree(older.getResponse().getContentAsString())
                .path("recipeId")
                .asString();

        // MySQL TIMESTAMP is second precision — bump older created_at so ordering is deterministic.
        jdbcTemplate.update(
                "UPDATE dieta_recipes SET created_at = DATE_SUB(created_at, INTERVAL 2 SECOND) WHERE id = ?",
                olderId);

        MvcResult newer = mockMvc.perform(post("/api/v1/dieta/recipes/analyze")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(recipeJson(day2, "닭가슴살 샐러드")))
                .andExpect(status().isOk())
                .andReturn();

        String newerId = objectMapper
                .readTree(newer.getResponse().getContentAsString())
                .path("recipeId")
                .asString();
        assertThat(UUID.fromString(newerId)).isNotEqualTo(UUID.fromString(olderId));

        mockMvc.perform(get("/api/v1/dieta/recipes")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .param("loggedOn", day2.toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].title").value("닭가슴살 샐러드"));

        mockMvc.perform(get("/api/v1/dieta/recipes")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].id").value(newerId))
                .andExpect(jsonPath("$[0].title").value("닭가슴살 샐러드"))
                .andExpect(jsonPath("$[1].title").value("된장찌개"));
    }

    @Test
    void addRecipeToDay_copiesMacrosWithoutConsent_andMergesIntake() throws Exception {
        String email = "dieta5add_" + System.nanoTime() + "@example.com";
        String nickname = "dieta5a" + (System.nanoTime() % 1_000_000);
        String accessToken = signupAndLogin(email, nickname);

        mockMvc.perform(post("/api/v1/dieta/onboarding")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(onboardingJson(true)))
                .andExpect(status().isCreated());

        LocalDate day1 = LocalDate.now().minusDays(1);
        LocalDate today = LocalDate.now();

        MvcResult sourceResult = mockMvc.perform(post("/api/v1/dieta/recipes/analyze")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(recipeJson(day1)))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode sourceBody = objectMapper.readTree(sourceResult.getResponse().getContentAsString());
        String sourceId = sourceBody.path("recipeId").asString();
        int sourceKcal = sourceBody.path("kcal").asInt();
        double sourceCarb = sourceBody.path("carbG").asDouble();
        double sourceProtein = sourceBody.path("proteinG").asDouble();
        double sourceFat = sourceBody.path("fatG").asDouble();

        mockMvc.perform(patch("/api/v1/dieta/profile")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"geminiMealConsent\":false}"))
                .andExpect(status().isOk());

        // Copy-add must work without Gemini consent (no re-analyze).
        MvcResult addResult = mockMvc.perform(post("/api/v1/dieta/recipes/" + sourceId + "/add-to-day")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"loggedOn\":\"" + today + "\",\"mealType\":\"LUNCH\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.recipeId").isNotEmpty())
                .andExpect(jsonPath("$.kcal").value(sourceKcal))
                .andExpect(jsonPath("$.carbG").value(sourceCarb))
                .andExpect(jsonPath("$.proteinG").value(sourceProtein))
                .andExpect(jsonPath("$.fatG").value(sourceFat))
                .andExpect(jsonPath("$.intake.loggedOn").value(today.toString()))
                .andExpect(jsonPath("$.intake.kcal").value(sourceKcal))
                .andReturn();

        JsonNode addBody = objectMapper.readTree(addResult.getResponse().getContentAsString());
        String copyId = addBody.path("recipeId").asString();
        assertThat(copyId).isNotEqualTo(sourceId);
        assertThat(addBody.path("intake").path("sourceMealsJson").asString()).contains(copyId);

        mockMvc.perform(get("/api/v1/dieta/recipes")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .param("loggedOn", today.toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].id").value(copyId))
                .andExpect(jsonPath("$[0].title").value("된장찌개"))
                .andExpect(jsonPath("$[0].mealType").value("LUNCH"))
                .andExpect(jsonPath("$[0].kcal").value(sourceKcal));

        // Default mealType omitted → BAD_REQUEST when source meal_type is null.
        mockMvc.perform(post("/api/v1/dieta/recipes/" + sourceId + "/add-to-day")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"loggedOn\":\"" + today + "\"}"))
                .andExpect(status().isBadRequest());

        mockMvc.perform(post("/api/v1/dieta/recipes/" + sourceId + "/add-to-day")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"loggedOn\":\"" + today + "\",\"mealType\":\"DINNER\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.intake.kcal").value(sourceKcal * 2));

        MvcResult dayList = mockMvc.perform(get("/api/v1/dieta/recipes")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .param("loggedOn", today.toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andReturn();

        JsonNode dayRecipes = objectMapper.readTree(dayList.getResponse().getContentAsString());
        java.util.List<String> mealTypes = new java.util.ArrayList<>();
        for (JsonNode row : dayRecipes) {
            mealTypes.add(row.path("mealType").asString());
        }
        assertThat(mealTypes).containsExactlyInAnyOrder("LUNCH", "DINNER");
    }

    @Test
    void analyzeRecipe_rejectsMissingOrInvalidServings() throws Exception {
        String email = "dieta5srv_" + System.nanoTime() + "@example.com";
        String nickname = "dieta5s" + (System.nanoTime() % 1_000_000);
        String accessToken = signupAndLogin(email, nickname);

        mockMvc.perform(post("/api/v1/dieta/onboarding")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(onboardingJson(true)))
                .andExpect(status().isCreated());

        LocalDate today = LocalDate.now();
        mockMvc.perform(post("/api/v1/dieta/recipes/analyze")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "loggedOn":"%s",
                                  "title":"된장찌개",
                                  "ingredients":["된장 30g"],
                                  "servings":0
                                }
                                """.formatted(today)))
                .andExpect(status().isBadRequest());

        mockMvc.perform(post("/api/v1/dieta/recipes/analyze")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "loggedOn":"%s",
                                  "title":"된장찌개",
                                  "ingredients":["된장 30g"]
                                }
                                """.formatted(today)))
                .andExpect(status().isBadRequest());
    }

    private static String recipeJson(LocalDate loggedOn) {
        return recipeJson(loggedOn, "된장찌개");
    }

    private static String recipeJson(LocalDate loggedOn, String title) {
        return """
                {
                  "loggedOn":"%s",
                  "title":"%s",
                  "ingredients":["된장 30g","두부 150g","애호박 80g"],
                  "steps":"끓여서 완성",
                  "servings":4
                }
                """.formatted(loggedOn, title);
    }

    private String signupAndLogin(String email, String nickname) throws Exception {
        String clientIp = "10.7." + ((System.nanoTime() >> 8) & 0xff) + "." + (System.nanoTime() & 0xff);
        mockMvc.perform(post("/api/v1/auth/email/request")
                        .header("X-Forwarded-For", clientIp)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\"}"))
                .andExpect(status().isOk());

        String code = stringRedisTemplate.opsForValue().get("signup:" + email);
        mockMvc.perform(post("/api/v1/auth/email/verify")
                        .header("X-Forwarded-For", clientIp)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\",\"code\":\"" + code + "\"}"))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/v1/auth/signup")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(signupJson(email, nickname)))
                .andExpect(status().isCreated());

        MvcResult login = mockMvc.perform(post("/api/v1/auth/login")
                        .header("X-Forwarded-For", clientIp)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\",\"password\":\"" + PASSWORD + "\"}"))
                .andExpect(status().isOk())
                .andReturn();

        String body = login.getResponse().getContentAsString();
        int start = body.indexOf("\"accessToken\":\"") + "\"accessToken\":\"".length();
        int end = body.indexOf('"', start);
        return body.substring(start, end);
    }

    private static String signupJson(String email, String nickname) {
        StringBuilder consents = new StringBuilder("[");
        boolean first = true;
        for (ConsentCatalog item : ConsentCatalog.activeItems()) {
            if (!first) {
                consents.append(',');
            }
            first = false;
            consents.append("{\"key\":\"")
                    .append(item.key())
                    .append("\",\"agreed\":true,\"version\":\"")
                    .append(item.version())
                    .append("\"}");
        }
        consents.append(']');
        return "{\"email\":\"" + email + "\",\"nickname\":\"" + nickname
                + "\",\"password\":\"" + PASSWORD + "\",\"consents\":" + consents + "}";
    }

    private static String onboardingJson(boolean geminiConsent) {
        return """
                {
                  "heightCm": 175.0,
                  "weightKg": 80.0,
                  "bodyFatMassKg": null,
                  "skeletalMuscleMassKg": null,
                  "ageYears": 30,
                  "sex": "M",
                  "goalType": "LOSS",
                  "weeklyTargetKg": 0.5,
                  "targetWeightKg": 70.0,
                  "weeklyBodyFatLossKg": null,
                  "weeklyMuscleGainKg": null,
                  "intensityPreference": null,
                  "bmrKcal": null,
                  "activityFactor": 1.4,
                  "dietStyle": "BALANCED",
                  "macros": {"carbPct": 0.4, "proteinPct": 0.3, "fatPct": 0.3},
                  "macrosCustomized": false,
                  "lossInitialDeficitKcal": 400,
                  "gainInitialSurplusKcal": 250,
                  "lossCutKcal": 175,
                  "lossRecoverKcal": 150,
                  "lossActivityKcal": 150,
                  "gainSurplusKcal": 250,
                  "gainCutKcal": 175,
                  "gainCeilingDeltaKcal": 500,
                  "geminiMealConsent": %s
                }
                """.formatted(geminiConsent);
    }
}
