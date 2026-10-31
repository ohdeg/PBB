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

class DietaPhase2CheckInIT extends AbstractIntegrationTest {

    private static final String PASSWORD = "Passw0rd!";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private StringRedisTemplate stringRedisTemplate;

    @Test
    void proposalIgnoresClientIntakeAndApplyRejectsMissingRevision() throws Exception {
        String token = onboardLossUser();
        LocalDate today = LocalDate.now();
        seedWeekBaseline(token, today.minusDays(8), "80.0");
        mockMvc.perform(post("/api/v1/dieta/check-ins/proposal")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"loggedOn\":\"" + today + "\",\"weightKg\":79.9,\"avgIntakeKcal\":9999,\"intakeDays\":7}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.intakeDays").value(0))
                .andExpect(jsonPath("$.revisionToken").isNotEmpty());
        mockMvc.perform(post("/api/v1/dieta/check-ins/apply")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"loggedOn\":\"" + today + "\",\"weightKg\":79.9,\"keepTargets\":true}"))
                .andExpect(status().isConflict());
    }

    @Test
    void apply_keepTargetsTrue_preservesDailyAndActivity() throws Exception {
        String accessToken = onboardLossUser();
        LocalDate today = LocalDate.now();
        LocalDate weekStart = today.minusDays(8);
        seedWeekBaseline(accessToken, weekStart, "80.0");

        MvcResult profileBefore = mockMvc.perform(get("/api/v1/dieta/profile")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andReturn();
        int dailyBefore = extractInt(profileBefore.getResponse().getContentAsString(), "dailyKcal");
        int activityBefore = extractInt(
                profileBefore.getResponse().getContentAsString(), "weekActivityExtraKcal");

        // Plateau delta → CUT would go below BMR → product forces ADD_ACTIVITY
        mockMvc.perform(post("/api/v1/dieta/check-ins/apply")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(withRevision(accessToken, """
                                {"loggedOn":"%s","weightKg":79.9,"keepTargets":true,\
                                "plateauChoice":"CUT_KCAL","avgIntakeKcal":0,"intakeDays":0}
                                """.formatted(today))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.checkIn.keepTargets").value(true))
                .andExpect(jsonPath("$.profile.dailyKcal").value(dailyBefore))
                .andExpect(jsonPath("$.profile.weekActivityExtraKcal").value(activityBefore))
                .andExpect(jsonPath("$.profile.weekStartsOn").value(today.toString()))
                .andExpect(jsonPath("$.proposal.eval").value("PLATEAU"))
                .andExpect(jsonPath("$.proposal.action").value("ADD_ACTIVITY"));

        mockMvc.perform(get("/api/v1/dieta/check-ins")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].keepTargets").value(true))
                .andExpect(jsonPath("$[0].appliedDailyKcal").value(dailyBefore));

        mockMvc.perform(get("/api/v1/dieta/body-logs")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.loggedOn=='%s')].source".formatted(today))
                        .value(org.hamcrest.Matchers.hasItem("CHECK_IN")));
    }

    @Test
    void apply_keepTargetsFalse_appliesCutPrescription() throws Exception {
        String accessToken = onboardLossUser();
        LocalDate today = LocalDate.now();
        LocalDate weekStart = today.minusDays(8);
        seedWeekBaseline(accessToken, weekStart, "80.0");

        MvcResult profileBefore = mockMvc.perform(get("/api/v1/dieta/profile")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andReturn();
        int dailyBefore = extractInt(profileBefore.getResponse().getContentAsString(), "dailyKcal");

        mockMvc.perform(post("/api/v1/dieta/check-ins/apply")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(withRevision(accessToken, """
                                {"loggedOn":"%s","weightKg":79.9,"keepTargets":false,\
                                "plateauChoice":"CUT_KCAL"}
                                """.formatted(today))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.checkIn.keepTargets").value(false))
                // daily − cut would be below BMR → ADD_ACTIVITY instead
                .andExpect(jsonPath("$.profile.dailyKcal").value(dailyBefore))
                .andExpect(jsonPath("$.profile.weekActivityExtraKcal").value(150))
                .andExpect(jsonPath("$.profile.weekStartsOn").value(today.toString()))
                .andExpect(jsonPath("$.proposal.action").value("ADD_ACTIVITY"));
    }

    @Test
    void apply_targetWeightReached_switchesToMaintain() throws Exception {
        String accessToken = onboardLossUser();
        LocalDate today = LocalDate.now();
        LocalDate weekStart = today.minusDays(8);
        seedWeekBaseline(accessToken, weekStart, "80.0");

        mockMvc.perform(post("/api/v1/dieta/check-ins/proposal")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"loggedOn":"%s","weightKg":70.0,"plateauChoice":"CUT_KCAL"}
                                """.formatted(today)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.targetWeightReached").value(true))
                .andExpect(jsonPath("$.eval").value("MAINTAIN"))
                .andExpect(jsonPath("$.proposedActivityExtraKcal").value(0))
                .andExpect(jsonPath("$.due").value(true));

        mockMvc.perform(post("/api/v1/dieta/check-ins/apply")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(withRevision(accessToken, """
                                {"loggedOn":"%s","weightKg":70.0,"keepTargets":true}
                                """.formatted(today))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.profile.goalType").value("MAINTAIN"))
                .andExpect(jsonPath("$.profile.weeklyTargetKg").value(0))
                .andExpect(jsonPath("$.profile.weekActivityExtraKcal").value(0))
                .andExpect(jsonPath("$.profile.lastNonMaintainGoalType").value("LOSS"))
                .andExpect(jsonPath("$.checkIn.keepTargets").value(false))
                .andExpect(jsonPath("$.proposal.targetWeightReached").value(true));
    }

    @Test
    void changedProfileAndRepeatedApplyRequireNewProposal() throws Exception {
        String token = onboardLossUser();
        LocalDate today = LocalDate.now();
        seedWeekBaseline(token, today.minusDays(8), "80.0");
        String body = "{\"loggedOn\":\"" + today + "\",\"weightKg\":79.9,\"keepTargets\":true}";
        String stale = withRevision(token, body);
        mockMvc.perform(patch("/api/v1/dieta/profile").header(HttpHeaders.AUTHORIZATION, "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON).content("{\"lossCutKcal\":200}"))
                .andExpect(status().isOk());
        mockMvc.perform(post("/api/v1/dieta/check-ins/apply").header(HttpHeaders.AUTHORIZATION, "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON).content(stale)).andExpect(status().isConflict());
        String fresh = withRevision(token, body);
        mockMvc.perform(post("/api/v1/dieta/check-ins/apply").header(HttpHeaders.AUTHORIZATION, "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON).content(fresh)).andExpect(status().isOk());
        mockMvc.perform(post("/api/v1/dieta/check-ins/apply").header(HttpHeaders.AUTHORIZATION, "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON).content(fresh)).andExpect(status().isConflict());
    }

    @Autowired
    private org.springframework.jdbc.core.JdbcTemplate jdbc;

    @Test
    void intakeAggregationUsesOwnRecordedDatesWithExclusiveEndAndDetectsOffsettingChanges() throws Exception {
        String token = onboardLossUser();
        String other = onboardLossUser();
        LocalDate today = LocalDate.now();
        LocalDate start = today.minusDays(8);
        seedWeekBaseline(token, start, "80.0");
        var mapper = tools.jackson.databind.json.JsonMapper.builder().build();
        String userId = mapper.readTree(mockMvc.perform(get("/api/v1/dieta/profile")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + token)).andReturn().getResponse().getContentAsString()).path("userId").asString();
        String otherId = mapper.readTree(mockMvc.perform(get("/api/v1/dieta/profile")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + other)).andReturn().getResponse().getContentAsString()).path("userId").asString();
        seedIntake(userId, start.minusDays(1), 9000);
        seedIntake(userId, start, 1600);
        seedIntake(userId, today.minusDays(1), 2000);
        seedIntake(userId, today, 9000);
        seedIntake(otherId, start, 9000);
        String body = "{\"loggedOn\":\"" + today + "\",\"weightKg\":79.9,\"keepTargets\":true}";
        var preview = mockMvc.perform(post("/api/v1/dieta/check-ins/proposal")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + token).contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(jsonPath("$.intakeDays").value(2)).andExpect(jsonPath("$.avgIntakeKcal").value(1800)).andReturn();
        var payload = (tools.jackson.databind.node.ObjectNode) mapper.readTree(body);
        payload.put("revisionToken", mapper.readTree(preview.getResponse().getContentAsString()).path("revisionToken").asString());
        // Same mean/day count, different individual records: the old preview must still be rejected.
        jdbc.update("UPDATE dieta_intake_logs SET kcal=1700 WHERE user_id=? AND logged_on=?", userId, start);
        jdbc.update("UPDATE dieta_intake_logs SET kcal=1900 WHERE user_id=? AND logged_on=?", userId, today.minusDays(1));
        mockMvc.perform(post("/api/v1/dieta/check-ins/apply")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + token).contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(payload))).andExpect(status().isConflict());
    }

    private void seedIntake(String userId, LocalDate day, int kcal) {
        jdbc.update("INSERT INTO dieta_intake_logs(id,user_id,logged_on,kcal) VALUES (?,?,?,?)",
                java.util.UUID.randomUUID().toString(), userId, day, kcal);
    }

    private String withRevision(String token, String body) throws Exception {
        var mapper = tools.jackson.databind.json.JsonMapper.builder().build();
        var payload = (tools.jackson.databind.node.ObjectNode) mapper.readTree(body);
        var preview = mockMvc.perform(post("/api/v1/dieta/check-ins/proposal")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk()).andReturn();
        payload.put("revisionToken", mapper.readTree(preview.getResponse().getContentAsString())
                .path("revisionToken").asString());
        return mapper.writeValueAsString(payload);
    }

    private void seedWeekBaseline(String accessToken, LocalDate weekStart, String weightKg)
            throws Exception {
        mockMvc.perform(put("/api/v1/dieta/body-logs")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"loggedOn":"%s","weightKg":%s,"bodyFatMassKg":null,\
                                "skeletalMuscleMassKg":null,"fasted":true,"source":"ONBOARDING"}
                                """.formatted(weekStart, weightKg)))
                .andExpect(status().isOk());

        mockMvc.perform(patch("/api/v1/dieta/profile")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"weekStartsOn\":\"%s\"}".formatted(weekStart)))
                .andExpect(status().isOk());
    }

    private String onboardLossUser() throws Exception {
        String email = "dieta2_" + System.nanoTime() + "@example.com";
        String nickname = "dieta2" + (System.nanoTime() % 1_000_000);
        String accessToken = signupAndLogin(email, nickname);
        mockMvc.perform(post("/api/v1/dieta/onboarding")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(onboardingJson("LOSS")))
                .andExpect(status().isCreated());
        return accessToken;
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

    private static int extractInt(String json, String field) {
        String key = "\"" + field + "\":";
        int i = json.indexOf(key);
        if (i < 0) {
            throw new IllegalStateException("missing " + field);
        }
        int start = i + key.length();
        int end = start;
        while (end < json.length() && (Character.isDigit(json.charAt(end)) || json.charAt(end) == '-')) {
            end++;
        }
        return Integer.parseInt(json.substring(start, end));
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
