package com.studiobs.spring_backend.domain.brew;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.studiobs.spring_backend.domain.auth.consent.ConsentCatalog;
import com.studiobs.spring_backend.support.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

class VevenoPosIT extends AbstractIntegrationTest {

    private static final String PASSWORD = "Passw0rd!";
    private static final String DEVICE = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private StringRedisTemplate stringRedisTemplate;

    @Test
    void ownerEnrollClaimAndPosCannotPatchStore() throws Exception {
        String email = "pos_owner_" + System.nanoTime() + "@example.com";
        String token = signupAndLogin(email, "posown" + (System.nanoTime() % 1_000_000));

        MvcResult created = mockMvc.perform(post("/api/v1/veveno/stores")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"POS Cafe\",\"isPublic\":true}"))
                .andExpect(status().isCreated())
                .andReturn();
        String storeId = jsonField(created, "id");

        MvcResult pairRes = mockMvc.perform(post("/api/v1/veveno/pos/sessions")
                        .header("X-Forwarded-For", uniqueIp())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"deviceId\":\"" + DEVICE + "\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.pairId").isNotEmpty())
                .andReturn();
        String pairId = jsonField(pairRes, "pairId");
        String secret = jsonField(pairRes, "secret");

        mockMvc.perform(post("/api/v1/veveno/pos/sessions/" + pairId + "/approve")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"storeId\":\"" + storeId + "\",\"secret\":\"" + secret + "\"}"))
                .andExpect(status().isNoContent());

        mockMvc.perform(post("/api/v1/veveno/pos/sessions/poll")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"pairs\":[{\"pairId\":\"" + pairId + "\",\"secret\":\"" + secret + "\"}]}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ready"));

        MvcResult claimed = mockMvc.perform(post("/api/v1/veveno/pos/sessions/" + pairId + "/claim")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"secret\":\"" + secret + "\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken").isNotEmpty())
                .andExpect(jsonPath("$.canEditStock").value(true))
                .andReturn();
        String posToken = jsonField(claimed, "accessToken");

        mockMvc.perform(get("/api/v1/veveno/stores/" + storeId)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + posToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.owned").value(false))
                .andExpect(jsonPath("$.subscribed").value(true))
                .andExpect(jsonPath("$.canEditStock").value(true))
                .andExpect(jsonPath("$.inviteCode").doesNotExist());

        mockMvc.perform(patch("/api/v1/veveno/stores/" + storeId)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + posToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Hacked\",\"isPublic\":true,\"stockEditOffDuty\":false,\"stockUsageHint\":false}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("POS_MANAGEMENT_FORBIDDEN"));

        mockMvc.perform(post("/api/v1/veveno/pos/session/extend")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + posToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken").isNotEmpty());
    }

    @Test
    void staffCannotEnrollUnpairedPos() throws Exception {
        String ownerEmail = "pos_ow_" + System.nanoTime() + "@example.com";
        String ownerToken = signupAndLogin(ownerEmail, "ow" + (System.nanoTime() % 1_000_000));
        MvcResult created = mockMvc.perform(post("/api/v1/veveno/stores")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + ownerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Staff POS\",\"isPublic\":true}"))
                .andExpect(status().isCreated())
                .andReturn();
        String storeId = jsonField(created, "id");

        String otherEmail = "pos_st_" + System.nanoTime() + "@example.com";
        String otherToken = signupAndLogin(otherEmail, "st" + (System.nanoTime() % 1_000_000));

        String device = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
        MvcResult pairRes = mockMvc.perform(post("/api/v1/veveno/pos/sessions")
                        .header("X-Forwarded-For", uniqueIp())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"deviceId\":\"" + device + "\"}"))
                .andExpect(status().isOk())
                .andReturn();
        mockMvc.perform(post("/api/v1/veveno/pos/sessions/" + jsonField(pairRes, "pairId") + "/approve")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + otherToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"storeId\":\"" + storeId + "\",\"secret\":\""
                                + jsonField(pairRes, "secret") + "\"}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("POS_OWNER_ENROLL_ONLY"));
    }

    private String signupAndLogin(String email, String nickname) throws Exception {
        String clientIp = uniqueIp();
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
        return jsonField(login, "accessToken");
    }

    private static String uniqueIp() {
        return "10.9." + ((System.nanoTime() >> 8) & 0xff) + "." + (System.nanoTime() & 0xff);
    }

    private static String jsonField(MvcResult result, String field) throws Exception {
        String body = result.getResponse().getContentAsString();
        String needle = "\"" + field + "\":\"";
        int start = body.indexOf(needle);
        if (start < 0) {
            needle = "\"" + field + "\":";
            start = body.indexOf(needle);
            if (start < 0) {
                throw new IllegalStateException(field + " missing in " + body);
            }
            start += needle.length();
            int end = start;
            while (end < body.length() && (Character.isLetterOrDigit(body.charAt(end))
                    || body.charAt(end) == '-' || body.charAt(end) == '.')) {
                end++;
            }
            return body.substring(start, end);
        }
        start += needle.length();
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
}
