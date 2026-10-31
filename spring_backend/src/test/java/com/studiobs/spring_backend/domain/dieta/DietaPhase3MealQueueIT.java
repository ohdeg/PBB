package com.studiobs.spring_backend.domain.dieta;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.studiobs.spring_backend.domain.auth.consent.ConsentCatalog;
import com.studiobs.spring_backend.support.AbstractIntegrationTest;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

@org.springframework.context.annotation.Import(DietaGeminiTestConfiguration.class)
class DietaPhase3MealQueueIT extends AbstractIntegrationTest {

    private static final String PASSWORD = "Passw0rd!";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private StringRedisTemplate stringRedisTemplate;

    @org.springframework.test.context.bean.override.mockito.MockitoSpyBean(name = "fixtureGeminiClient")
    private com.studiobs.spring_backend.domain.dieta.client.GeminiMealClient analysisClient;

    @Autowired
    private org.springframework.jdbc.core.JdbcTemplate jdbc;

    @Test
    void concurrentAddsAndPendingEditsCannotLoseItems() throws Exception {
        String email = "dietaRace_" + System.nanoTime() + "@example.com";
        String token = signupAndLogin(email, "race" + System.nanoTime() % 1000000);
        mockMvc.perform(post("/api/v1/dieta/onboarding").header(HttpHeaders.AUTHORIZATION, "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON).content(onboardingJson(true))).andExpect(status().isCreated());
        LocalDate today = LocalDate.now();
        try (var pool = java.util.concurrent.Executors.newFixedThreadPool(2)) {
            var start = new java.util.concurrent.CountDownLatch(1);
            var a = pool.submit(() -> { start.await(); return addFood(token, today, "밥"); });
            var b = pool.submit(() -> { start.await(); return addFood(token, today, "두부"); });
            start.countDown();
            org.assertj.core.api.Assertions.assertThat(a.get().getResponse().getStatus()).isEqualTo(200);
            org.assertj.core.api.Assertions.assertThat(b.get().getResponse().getStatus()).isEqualTo(200);
            var queue = mockMvc.perform(get("/api/v1/dieta/meal-queue/" + today)
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
                    .andExpect(jsonPath("$.items.length()").value(2)).andReturn();
            String id = extractItemId(queue.getResponse().getContentAsString());
            var entered = new java.util.concurrent.CountDownLatch(1);
            var release = new java.util.concurrent.CountDownLatch(1);
            org.mockito.Mockito.doAnswer(invocation -> {
                entered.countDown();
                if (!release.await(10, java.util.concurrent.TimeUnit.SECONDS)) throw new IllegalStateException("test timeout");
                return invocation.callRealMethod();
            }).when(analysisClient).analyze(org.mockito.ArgumentMatchers.any());
            try {
                var finalize = pool.submit(() -> mockMvc.perform(post("/api/v1/dieta/meal-queue/finalize")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + token).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"loggedOn\":\"" + today + "\"}")).andReturn());
                org.assertj.core.api.Assertions.assertThat(entered.await(10, java.util.concurrent.TimeUnit.SECONDS)).isTrue();
                org.assertj.core.api.Assertions.assertThat(addFood(token, today, "빵").getResponse().getStatus()).isEqualTo(409);
                mockMvc.perform(delete("/api/v1/dieta/meal-queue/items/" + id)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + token).param("loggedOn", today.toString()))
                        .andExpect(status().isConflict());
                mockMvc.perform(post("/api/v1/dieta/meal-queue/finalize")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + token).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"loggedOn\":\"" + today + "\"}"))
                        .andExpect(status().isConflict());
                release.countDown();
                org.assertj.core.api.Assertions.assertThat(finalize.get().getResponse().getStatus()).isEqualTo(200);
            } finally { release.countDown(); org.mockito.Mockito.reset(analysisClient); }
        }
        String userId = jdbc.queryForObject("SELECT id FROM users WHERE email = ?", String.class, email.toLowerCase());
        stringRedisTemplate.delete("dieta:mealq:" + userId + ":" + today);
        mockMvc.perform(get("/api/v1/dieta/meal-queue/" + today)
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + token)).andExpect(jsonPath("$.status").value("done"));
        org.assertj.core.api.Assertions.assertThat(addFood(token, today, "빵").getResponse().getStatus()).isEqualTo(409);
    }

    @org.springframework.test.context.bean.override.mockito.MockitoSpyBean
    private com.studiobs.spring_backend.domain.dieta.service.DietaMealQueueRedisService queueStore;

    @Test
    void analysisFailurePreservesQueueAndCanBeRetried() throws Exception {
        String token = newQueueUser("retry");
        LocalDate day = LocalDate.now();
        addFood(token, day, "밥");
        org.mockito.Mockito.doThrow(new com.studiobs.spring_backend.global.exception.BusinessException(
                org.springframework.http.HttpStatus.BAD_GATEWAY, "analysis failed"))
                .when(analysisClient).analyze(org.mockito.ArgumentMatchers.any());
        try {
            finish(token, day).andExpect(status().isBadGateway());
            mockMvc.perform(get("/api/v1/dieta/meal-queue/" + day).header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
                    .andExpect(jsonPath("$.status").value("failed")).andExpect(jsonPath("$.items.length()").value(1));
            mockMvc.perform(get("/api/v1/dieta/intakes").header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
                    .andExpect(jsonPath("$.length()").value(0));
        } finally { org.mockito.Mockito.reset(analysisClient); }
        finish(token, day).andExpect(status().isOk()).andExpect(jsonPath("$.intake.kcal").value(270));
    }

    @Test
    void redisCompletionFailureDoesNotUndoCommittedIntake() throws Exception {
        String token = newQueueUser("redisfail");
        LocalDate day = LocalDate.now();
        addFood(token, day, "밥");
        org.mockito.Mockito.doAnswer(invocation -> {
            var queue = (com.studiobs.spring_backend.domain.dieta.dto.meal.DietaMealQueueDayResponse) invocation.getArgument(1);
            if ("done".equals(queue.status())) throw new IllegalStateException("Redis completion unavailable");
            return invocation.callRealMethod();
        }).when(queueStore).save(org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any());
        try { finish(token, day).andExpect(status().isOk()).andExpect(jsonPath("$.queue.status").value("done")); }
        finally { org.mockito.Mockito.reset(queueStore); }
        // If recovery attempted a second AI call this request would fail.
        org.mockito.Mockito.doThrow(new IllegalStateException("must not reanalyze"))
                .when(analysisClient).analyze(org.mockito.ArgumentMatchers.any());
        try {
            finish(token, day).andExpect(status().isOk()).andExpect(jsonPath("$.intake.kcal").value(270));
            mockMvc.perform(get("/api/v1/dieta/intakes").header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
                    .andExpect(jsonPath("$.length()").value(1));
        } finally { org.mockito.Mockito.reset(analysisClient); }
    }

    @Test
    void expiredWorkerCannotOverwriteReplacementResult() throws Exception {
        String token = newQueueUser("lease");
        LocalDate day = LocalDate.now();
        addFood(token, day, "밥");
        var profile = mockMvc.perform(get("/api/v1/dieta/profile").header(HttpHeaders.AUTHORIZATION, "Bearer " + token)).andReturn();
        var mapper = tools.jackson.databind.json.JsonMapper.builder().build();
        String userId = mapper.readTree(profile.getResponse().getContentAsString()).path("userId").asString();
        String key = "dieta:mealq:" + userId + ":" + day;
        var entered = new java.util.concurrent.CountDownLatch(1);
        var release = new java.util.concurrent.CountDownLatch(1);
        var calls = new java.util.concurrent.atomic.AtomicInteger();
        org.mockito.Mockito.doAnswer(invocation -> {
            if (calls.incrementAndGet() == 1) {
                entered.countDown();
                if (!release.await(10, java.util.concurrent.TimeUnit.SECONDS)) throw new IllegalStateException("test timeout");
            }
            return invocation.callRealMethod();
        }).when(analysisClient).analyze(org.mockito.ArgumentMatchers.any());
        try (var pool = java.util.concurrent.Executors.newSingleThreadExecutor()) {
            var old = pool.submit(() -> finish(token, day).andReturn());
            try {
                org.assertj.core.api.Assertions.assertThat(entered.await(10, java.util.concurrent.TimeUnit.SECONDS)).isTrue();
                var expired = (tools.jackson.databind.node.ObjectNode) mapper.readTree(stringRedisTemplate.opsForValue().get(key));
                expired.put("updatedAt", java.time.Instant.now().minusSeconds(121).toString());
                stringRedisTemplate.opsForValue().set(key, mapper.writeValueAsString(expired), java.time.Duration.ofHours(48));
                mockMvc.perform(get("/api/v1/dieta/meal-queue/" + day).header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
                        .andExpect(jsonPath("$.status").value("failed"));
                finish(token, day).andExpect(status().isOk());
                release.countDown();
                org.assertj.core.api.Assertions.assertThat(old.get().getResponse().getStatus()).isEqualTo(409);
                mockMvc.perform(get("/api/v1/dieta/meal-queue/" + day).header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
                        .andExpect(jsonPath("$.status").value("done"));
                mockMvc.perform(get("/api/v1/dieta/intakes").header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
                        .andExpect(jsonPath("$.length()").value(1)).andExpect(jsonPath("$[0].kcal").value(270));
            } finally { release.countDown(); }
        } finally { org.mockito.Mockito.reset(analysisClient); }
    }

    @org.springframework.test.context.bean.override.mockito.MockitoSpyBean
    private com.studiobs.spring_backend.domain.dieta.repository.DietaIntakeLogRepository intakeRepository;

    @Test
    void dbCommitFailureRollsBackIntakeAndPreservesRetryableQueue() throws Exception {
        String token = newQueueUser("rollback");
        LocalDate day = LocalDate.now();
        addFood(token, day, "밥");
        org.mockito.Mockito.doAnswer(invocation -> {
            org.springframework.transaction.support.TransactionSynchronizationManager.registerSynchronization(
                    new org.springframework.transaction.support.TransactionSynchronization() {
                        @Override public void beforeCommit(boolean readOnly) { throw new IllegalStateException("commit failure"); }
                    });
            return invocation.callRealMethod();
        }).when(intakeRepository).save(org.mockito.ArgumentMatchers.any());
        try { finish(token, day).andExpect(status().is5xxServerError()); }
        finally { org.mockito.Mockito.reset(intakeRepository); }
        mockMvc.perform(get("/api/v1/dieta/intakes").header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
                .andExpect(jsonPath("$.length()").value(0));
        mockMvc.perform(get("/api/v1/dieta/meal-queue/" + day).header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
                .andExpect(jsonPath("$.status").value("failed")).andExpect(jsonPath("$.items.length()").value(1));
        finish(token, day).andExpect(status().isOk());
    }

    @Test
    void recipeAddedDuringAnalysisIsIncludedInFinalTotal() throws Exception {
        String token = newQueueUser("merge");
        LocalDate day = LocalDate.now();
        var created = mockMvc.perform(post("/api/v1/dieta/recipes/analyze")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + token).contentType(MediaType.APPLICATION_JSON)
                .content("{\"loggedOn\":\"" + day + "\",\"title\":\"recipe\",\"ingredients\":[\"두부\"],\"servings\":1}"))
                .andExpect(status().isOk()).andReturn();
        var mapper = tools.jackson.databind.json.JsonMapper.builder().build();
        String id = mapper.readTree(created.getResponse().getContentAsString()).path("recipeId").asString();
        addFood(token, day, "밥");
        var entered = new java.util.concurrent.CountDownLatch(1);
        var release = new java.util.concurrent.CountDownLatch(1);
        org.mockito.Mockito.doAnswer(invocation -> {
            entered.countDown();
            if (!release.await(10, java.util.concurrent.TimeUnit.SECONDS)) throw new IllegalStateException("test timeout");
            return invocation.callRealMethod();
        }).when(analysisClient).analyze(org.mockito.ArgumentMatchers.any());
        try (var pool = java.util.concurrent.Executors.newSingleThreadExecutor()) {
            var analysis = pool.submit(() -> finish(token, day).andReturn());
            try {
                org.assertj.core.api.Assertions.assertThat(entered.await(10, java.util.concurrent.TimeUnit.SECONDS)).isTrue();
                mockMvc.perform(post("/api/v1/dieta/recipes/" + id + "/add-to-day")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + token).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"loggedOn\":\"" + day + "\",\"mealType\":\"LUNCH\"}"))
                        .andExpect(status().isOk()).andExpect(jsonPath("$.intake.kcal").value(270));
                release.countDown();
                var result = analysis.get();
                org.assertj.core.api.Assertions.assertThat(result.getResponse().getStatus()).isEqualTo(200);
                org.assertj.core.api.Assertions.assertThat(mapper.readTree(result.getResponse().getContentAsString())
                        .path("intake").path("kcal").asInt()).isEqualTo(540);
            } finally { release.countDown(); }
        } finally { org.mockito.Mockito.reset(analysisClient); }
    }

    private String newQueueUser(String prefix) throws Exception {
        String email = prefix + System.nanoTime() + "@example.com";
        String token = signupAndLogin(email, "q" + System.nanoTime() % 1000000);
        mockMvc.perform(post("/api/v1/dieta/onboarding").header(HttpHeaders.AUTHORIZATION, "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON).content(onboardingJson(true))).andExpect(status().isCreated());
        return token;
    }

    private org.springframework.test.web.servlet.ResultActions finish(String token, LocalDate day) throws Exception {
        return mockMvc.perform(post("/api/v1/dieta/meal-queue/finalize")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + token).contentType(MediaType.APPLICATION_JSON)
                .content("{\"loggedOn\":\"" + day + "\"}"));
    }

    private MvcResult addFood(String token, LocalDate day, String text) throws Exception {
        return mockMvc.perform(post("/api/v1/dieta/meal-queue/items")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + token).contentType(MediaType.APPLICATION_JSON)
                .content("{\"loggedOn\":\"" + day + "\",\"mealType\":\"LUNCH\",\"text\":\"" + text + "\"}"))
                .andReturn();
    }

    @Test
    void mealQueue_addDelete_finalizeRequiresConsent_thenWritesIntake_andAutoFinalizeYesterday()
            throws Exception {
        String email = "dieta3_" + System.nanoTime() + "@example.com";
        String nickname = "dieta3" + (System.nanoTime() % 1_000_000);
        String accessToken = signupAndLogin(email, nickname);

        mockMvc.perform(post("/api/v1/dieta/onboarding")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(onboardingJson(true)))
                .andExpect(status().isCreated());

        LocalDate today = LocalDate.now();
        LocalDate yesterday = today.minusDays(1);

        mockMvc.perform(get("/api/v1/dieta/meal-queue")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .param("loggedOn", today.toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("open"))
                .andExpect(jsonPath("$.items").isEmpty());

        MvcResult add = mockMvc.perform(post("/api/v1/dieta/meal-queue/items")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"loggedOn":"%s","mealType":"LUNCH","text":"현미밥 한 공기"}
                                """.formatted(today)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items.length()").value(1))
                .andExpect(jsonPath("$.items[0].mealType").value("LUNCH"))
                .andExpect(jsonPath("$.items[0].text").value("현미밥 한 공기"))
                .andReturn();

        String itemId = extractItemId(add.getResponse().getContentAsString());

        mockMvc.perform(delete("/api/v1/dieta/meal-queue/items/" + itemId)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .param("loggedOn", today.toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items").isEmpty());

        mockMvc.perform(post("/api/v1/dieta/meal-queue/items")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"loggedOn":"%s","mealType":"DINNER","text":"닭가슴살 150g"}
                                """.formatted(today)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items.length()").value(1));

        // Revoke consent → finalize must fail
        mockMvc.perform(patch("/api/v1/dieta/profile")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"geminiMealConsent\":false}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.geminiMealConsent").value(false));

        mockMvc.perform(post("/api/v1/dieta/meal-queue/finalize")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"loggedOn\":\"" + today + "\"}"))
                .andExpect(status().isForbidden());

        // Restore consent → finalize writes intake (stub Gemini, no API key)
        mockMvc.perform(patch("/api/v1/dieta/profile")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"geminiMealConsent\":true}"))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/v1/dieta/meal-queue/finalize")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"loggedOn\":\"" + today + "\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.queue.status").value("done"))
                .andExpect(jsonPath("$.intake.loggedOn").value(today.toString()))
                .andExpect(jsonPath("$.intake.kcal").isNumber())
                .andExpect(jsonPath("$.intake.review").isNotEmpty())
                .andExpect(jsonPath("$.intake.sourceMealsJson").isNotEmpty());

        mockMvc.perform(get("/api/v1/dieta/intakes")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .param("loggedOn", today.toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].loggedOn").value(today.toString()));

        // A completed day is immutable even for direct API callers.
        mockMvc.perform(delete("/api/v1/dieta/meal-queue/items/" + itemId)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .param("loggedOn", today.toString()))
                .andExpect(status().isConflict());

        // Yesterday queue → auto-finalize
        mockMvc.perform(post("/api/v1/dieta/meal-queue/items")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"loggedOn":"%s","mealType":"BREAKFAST","text":"계란 2개"}
                                """.formatted(yesterday)))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/v1/dieta/meal-queue/auto-finalize-yesterday")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.queue.status").value("done"))
                .andExpect(jsonPath("$.intake.loggedOn").value(yesterday.toString()));

        // Second call → no-op 204
        mockMvc.perform(post("/api/v1/dieta/meal-queue/auto-finalize-yesterday")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/v1/dieta/meal-queue/" + yesterday)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("done"));
    }

    private static String extractItemId(String body) {
        int start = body.indexOf("\"id\":\"") + "\"id\":\"".length();
        int end = body.indexOf('"', start);
        return body.substring(start, end);
    }

    private String signupAndLogin(String email, String nickname) throws Exception {
        String clientIp = "10.6." + ((System.nanoTime() >> 8) & 0xff) + "." + (System.nanoTime() & 0xff);
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
