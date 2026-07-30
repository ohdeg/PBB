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

class DietaPhase3MealQueueIT extends AbstractIntegrationTest {

    private static final String PASSWORD = "Passw0rd!";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private StringRedisTemplate stringRedisTemplate;

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
