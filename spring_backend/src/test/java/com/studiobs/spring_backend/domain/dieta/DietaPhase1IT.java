package com.studiobs.spring_backend.domain.dieta;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
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

class DietaPhase1IT extends AbstractIntegrationTest {

    private static final String PASSWORD = "Passw0rd!";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private StringRedisTemplate stringRedisTemplate;

    @Test
    void onboarding_createsProfileAndBodyLog_thenMaintainAndUpserts() throws Exception {
        String email = "dieta_" + System.nanoTime() + "@example.com";
        String nickname = "dieta" + (System.nanoTime() % 1_000_000);
        String accessToken = signupAndLogin(email, nickname);

        mockMvc.perform(get("/api/v1/dieta/profile")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isNotFound());

        mockMvc.perform(post("/api/v1/dieta/onboarding")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(onboardingJson("LOSS")))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.goalType").value("LOSS"))
                .andExpect(jsonPath("$.onboardingComplete").value(true))
                .andExpect(jsonPath("$.lastNonMaintainGoalType").value("LOSS"))
                .andExpect(jsonPath("$.geminiMealConsent").value(true))
                .andExpect(jsonPath("$.macros.carbPct").value(0.4));

        mockMvc.perform(get("/api/v1/dieta/body-logs")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].source").value("ONBOARDING"))
                .andExpect(jsonPath("$[0].weightKg").value(80.0));

        mockMvc.perform(post("/api/v1/dieta/maintain-mode")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"enabled\":true}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.goalType").value("MAINTAIN"))
                .andExpect(jsonPath("$.weeklyTargetKg").value(0))
                .andExpect(jsonPath("$.lastNonMaintainGoalType").value("LOSS"));

        mockMvc.perform(post("/api/v1/dieta/maintain-mode")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"enabled\":false}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.goalType").value("LOSS"))
                .andExpect(jsonPath("$.lastNonMaintainGoalType").value("LOSS"));

        String today = LocalDate.now().toString();
        mockMvc.perform(put("/api/v1/dieta/body-logs")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"loggedOn":"%s","weightKg":79.5,"bodyFatMassKg":null,\
                                "skeletalMuscleMassKg":null,"fasted":true,"source":"DAILY_FASTED"}
                                """.formatted(today)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.weightKg").value(79.5))
                .andExpect(jsonPath("$.source").value("DAILY_FASTED"));

        mockMvc.perform(put("/api/v1/dieta/activities")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"loggedOn":"%s","steps":8000,"durationMin":40,\
                                "activityKcal":220,"note":"walk"}
                                """.formatted(today)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.steps").value(8000))
                .andExpect(jsonPath("$.activityKcal").value(220));

        mockMvc.perform(get("/api/v1/dieta/activities")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].steps").value(8000));

        mockMvc.perform(post("/api/v1/dieta/keto-events")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"easeRequested\":true}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.easeRequested").value(true));

        mockMvc.perform(get("/api/v1/dieta/keto-events")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].easeRequested").value(true));

        mockMvc.perform(patch("/api/v1/dieta/profile")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"geminiMealConsent\":false,\"weekActivityExtraKcal\":150}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.geminiMealConsent").value(false))
                .andExpect(jsonPath("$.weekActivityExtraKcal").value(150));
    }

    private String signupAndLogin(String email, String nickname) throws Exception {
        String clientIp = "10.5." + ((System.nanoTime() >> 8) & 0xff) + "." + (System.nanoTime() & 0xff);
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

    private static String onboardingJson(String goalType) {
        return """
                {
                  "heightCm": 175.0,
                  "weightKg": 80.0,
                  "bodyFatMassKg": null,
                  "skeletalMuscleMassKg": null,
                  "ageYears": 30,
                  "sex": "M",
                  "goalType": "%s",
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
                  "geminiMealConsent": true
                }
                """.formatted(goalType);
    }
}
