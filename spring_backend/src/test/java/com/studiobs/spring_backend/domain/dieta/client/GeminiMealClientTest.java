package com.studiobs.spring_backend.domain.dieta.client;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowableOfType;

import com.studiobs.spring_backend.domain.dieta.config.DietaGeminiProperties;
import com.studiobs.spring_backend.domain.dieta.dto.gemini.DietaGeminiMealRequest;
import com.studiobs.spring_backend.global.exception.BusinessException;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import tools.jackson.databind.json.JsonMapper;

class GeminiMealClientTest {
    @Test
    void missingKeyFailsInsteadOfInventingNutrition() {
        var client = new GeminiMealClient(new DietaGeminiProperties("", null, null), JsonMapper.builder().build(), org.springframework.web.client.RestClient.create());
        var request = new DietaGeminiMealRequest(1, "ko-KR", LocalDate.of(2026, 10, 31),
                new DietaGeminiMealRequest.GoalHint("LOSS", 2200, 1800, null),
                List.of(new DietaGeminiMealRequest.MealGroup("LUNCH", List.of("밥 한 공기"))),
                List.of(), new DietaGeminiMealRequest.ActivityHint(0, 0, null),
                DietaGeminiMealRequest.Instructions.productDefaults());
        var error = catchThrowableOfType(BusinessException.class, () -> client.analyze(request));
        assertThat(error).isNotNull();
        assertThat(error.getStatus()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
    }
    @Test
    void liveResponseMustHaveValidCompleteNutrition() throws Exception {
        var mapper = JsonMapper.builder().build();
        var builder = org.springframework.web.client.RestClient.builder().baseUrl("https://example.invalid");
        var server = org.springframework.test.web.client.MockRestServiceServer.bindTo(builder).build();
        var client = new GeminiMealClient(new DietaGeminiProperties("test-placeholder", "https://example.invalid", "fixture"),
                mapper, builder.build());
            var request = new DietaGeminiMealRequest(1, "ko-KR", LocalDate.of(2026, 10, 31), null,
                    List.of(), List.of(), null, DietaGeminiMealRequest.Instructions.productDefaults());
            String valid = "{\"schemaVersion\":1,\"loggedOn\":\"2026-10-31\",\"totals\":{\"carbG\":20,\"proteinG\":25,\"fatG\":10,\"kcal\":270},\"oneLineReview\":\"분석\"}";
            for (String invalid : List.of("not json", valid.replace("\"kcal\":270", "\"other\":270"),
                    valid.replace("\"carbG\":20", "\"carbG\":-1"), valid.replace("2026-10-31", "2026-10-30"),
                    valid.replace("\"fatG\":10", "\"fatG\":1000000"))) {
                server.expect(org.springframework.test.web.client.match.MockRestRequestMatchers.anything())
                        .andRespond(org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess(
                                envelope(mapper, invalid), org.springframework.http.MediaType.APPLICATION_JSON));
                var error = catchThrowableOfType(BusinessException.class, () -> client.analyze(request));
                assertThat(error).isNotNull();
                assertThat(error.getStatus()).isEqualTo(HttpStatus.BAD_GATEWAY);
                assertThat(error.getMessage()).doesNotContain("test-placeholder");
                server.verify();
                server.reset();
            }
            server.expect(org.springframework.test.web.client.match.MockRestRequestMatchers.anything())
                    .andRespond(org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess(
                            envelope(mapper, valid), org.springframework.http.MediaType.APPLICATION_JSON));
            assertThat(client.analyze(request).totals().kcal()).isEqualTo(270);
            server.verify();
    }

    @Test
    void transportTimeoutIsAnErrorRatherThanNutrition() {
        var builder = org.springframework.web.client.RestClient.builder().baseUrl("https://example.invalid");
        var server = org.springframework.test.web.client.MockRestServiceServer.bindTo(builder).build();
        server.expect(org.springframework.test.web.client.match.MockRestRequestMatchers.anything())
                .andRespond(org.springframework.test.web.client.response.MockRestResponseCreators.withException(
                        new java.net.SocketTimeoutException("simulated timeout")));
        var client = new GeminiMealClient(new DietaGeminiProperties("test-placeholder", "https://example.invalid", "fixture"),
                JsonMapper.builder().build(), builder.build());
        var request = new DietaGeminiMealRequest(1, "ko-KR", LocalDate.of(2026, 10, 31), null,
                List.of(), List.of(), null, DietaGeminiMealRequest.Instructions.productDefaults());
        var error = catchThrowableOfType(BusinessException.class, () -> client.analyze(request));
        assertThat(error.getStatus()).isEqualTo(HttpStatus.BAD_GATEWAY);
        server.verify();
    }

    private static String envelope(tools.jackson.databind.ObjectMapper mapper, String text) {
        return mapper.writeValueAsString(java.util.Map.of("candidates", List.of(java.util.Map.of(
                "content", java.util.Map.of("parts", List.of(java.util.Map.of("text", text)))))));
    }
}
