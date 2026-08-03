package com.studiobs.spring_backend.domain.brew;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import com.studiobs.spring_backend.domain.auth.consent.ConsentCatalog;
import com.studiobs.spring_backend.support.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

class BrewStockOptimisticLockIT extends AbstractIntegrationTest {

    private static final String PASSWORD = "Passw0rd!";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private StringRedisTemplate stringRedisTemplate;

    @Test
    void updateStock_rejectsStaleVersion_with409() throws Exception {
        String email = "stock_ol_" + System.nanoTime() + "@example.com";
        String nickname = "stol" + (System.nanoTime() % 1_000_000);
        String accessToken = signupAndLogin(email, nickname);

        MvcResult storeResult = mockMvc.perform(post("/api/v1/veveno/stores")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"OL Cafe\",\"isPublic\":false}"))
                .andExpect(status().isCreated())
                .andReturn();
        String storeId = JsonPath.read(storeResult.getResponse().getContentAsString(), "$.id");

        MvcResult categoryResult = mockMvc.perform(post("/api/v1/veveno/stores/" + storeId + "/stock-categories")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Beans\"}"))
                .andExpect(status().isCreated())
                .andReturn();
        int categoryId = JsonPath.read(categoryResult.getResponse().getContentAsString(), "$.id");

        MvcResult createStock = mockMvc.perform(post(
                        "/api/v1/veveno/stock-categories/" + categoryId + "/stocks")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"stockName\":\"Ethiopia\",\"stockNum\":2,\"stockMinNum\":1}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.version").value(0))
                .andReturn();

        int stockId = JsonPath.read(createStock.getResponse().getContentAsString(), "$.id");

        mockMvc.perform(patch("/api/v1/veveno/stocks/" + stockId)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"stockName\":\"Ethiopia\",\"stockNum\":3,\"stockMinNum\":1,\"version\":0}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.stockNum").value(3))
                .andExpect(jsonPath("$.version").value(1));

        mockMvc.perform(patch("/api/v1/veveno/stocks/" + stockId)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"stockName\":\"Ethiopia\",\"stockNum\":99,\"stockMinNum\":1,\"version\":0}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value(
                        "다른 사용자가 재고를 수정했습니다. 다시 불러온 뒤 수정하세요."));
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
}
