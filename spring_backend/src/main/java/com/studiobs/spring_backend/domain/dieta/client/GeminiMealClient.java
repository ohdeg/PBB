package com.studiobs.spring_backend.domain.dieta.client;

import com.studiobs.spring_backend.domain.dieta.config.DietaGeminiProperties;
import com.studiobs.spring_backend.domain.dieta.dto.gemini.DietaGeminiMealRequest;
import com.studiobs.spring_backend.domain.dieta.dto.gemini.DietaGeminiMealResponse;
import com.studiobs.spring_backend.global.exception.BusinessException;
import java.math.BigDecimal;
import java.util.List;
import java.util.Set;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/** Live analysis only: failures must never become nutrition records. */
@Slf4j
@Component
public class GeminiMealClient {

    private static final Set<String> API_STATUSES = Set.of(
            "INVALID_ARGUMENT", "FAILED_PRECONDITION", "OUT_OF_RANGE", "UNAUTHENTICATED",
            "PERMISSION_DENIED", "NOT_FOUND", "ALREADY_EXISTS", "RESOURCE_EXHAUSTED",
            "CANCELLED", "DATA_LOSS", "UNKNOWN", "INTERNAL", "UNAVAILABLE",
            "DEADLINE_EXCEEDED", "UNIMPLEMENTED", "ABORTED");
    private static final Set<String> API_REASONS = Set.of(
            "API_KEY_INVALID", "API_KEY_EXPIRED", "API_KEY_SERVICE_BLOCKED",
            "API_KEY_HTTP_REFERRER_BLOCKED", "API_KEY_IP_ADDRESS_BLOCKED",
            "API_KEY_ANDROID_APP_BLOCKED", "API_KEY_IOS_APP_BLOCKED",
            "SERVICE_DISABLED", "BILLING_DISABLED", "CONSUMER_INVALID",
            "RATE_LIMIT_EXCEEDED", "QUOTA_EXCEEDED", "ACCESS_TOKEN_EXPIRED",
            "ACCESS_TOKEN_SCOPE_INSUFFICIENT");

    private final DietaGeminiProperties properties;
    private final ObjectMapper objectMapper;
    private final RestClient restClient;

    public GeminiMealClient(DietaGeminiProperties properties, ObjectMapper objectMapper,
            @org.springframework.beans.factory.annotation.Qualifier("dietaGeminiRestClient") RestClient restClient) {
        this.properties = properties;
        this.objectMapper = objectMapper;
        this.restClient = restClient;
    }

    public DietaGeminiMealResponse analyze(DietaGeminiMealRequest request) {
        if (!properties.hasApiKey()) {
            throw new BusinessException(HttpStatus.SERVICE_UNAVAILABLE, "식단 분석을 사용할 수 없어요. 잠시 후 다시 시도해 주세요.");
        }
        try {
            return callGemini(request);
        } catch (Exception ex) {
            if (ex instanceof RestClientResponseException response) {
                logHttpFailure(response);
            } else {
                // Exception messages/stack traces can contain the key-bearing URL or meal data.
                log.warn("[DietaGemini] analysis failed (type={})", ex.getClass().getSimpleName());
            }
            throw new BusinessException(HttpStatus.BAD_GATEWAY, "식단 분석에 실패했어요. 기록은 보관되어 있으니 다시 시도해 주세요.");
        }
    }

    private void logHttpFailure(RestClientResponseException response) {
        String apiStatus = "UNKNOWN";
        String reason = "UNKNOWN";
        try {
            byte[] body = response.getResponseBodyAsByteArray();
            if (body.length > 0 && body.length <= 16_384) {
                JsonNode error = objectMapper.readTree(body).path("error");
                String status = error.path("status").asString("");
                if (API_STATUSES.contains(status)) apiStatus = status;
                JsonNode details = error.path("details");
                if (details.isArray()) {
                    for (JsonNode detail : details) {
                        if (!"type.googleapis.com/google.rpc.ErrorInfo".equals(detail.path("@type").asString(""))) continue;
                        String candidate = detail.path("reason").asString("");
                        if (API_REASONS.contains(candidate)) {
                            reason = candidate;
                            break;
                        }
                    }
                }
            }
        } catch (Exception ignored) {
            // Malformed/non-JSON errors still retain the HTTP status; never log raw bodies.
        }
        log.warn("[DietaGemini] analysis failed (httpStatus={}, apiStatus={}, reason={})",
                response.getStatusCode().value(), apiStatus, reason);
    }

    private DietaGeminiMealResponse callGemini(DietaGeminiMealRequest request) {
        String requestJson;
        try {
            requestJson = objectMapper.writeValueAsString(request);
        } catch (JacksonException ex) {
            throw new BusinessException(HttpStatus.INTERNAL_SERVER_ERROR, "Gemini 요청을 직렬화할 수 없습니다.");
        }

        String prompt = """
                You are a nutrition assistant. Analyze the following meal finalize JSON (schemaVersion 1).
                Return ONLY a JSON object with keys:
                schemaVersion (1), loggedOn (YYYY-MM-DD), totals { carbG, proteinG, fatG, kcal }, oneLineReview (Korean).
                Honor instructions: missingAmountAsOneServing, includeActivityInReview, estimateActivityKcalIfMissing,
                and when perServingOnly is true: totals MUST be macros/kcal for 1 serving only (divide the batch of
                instructions.servings into one portion) — never return the whole-pot totals unless servings is 1.
                `meals` are unanalyzed one-line items — estimate macros for those only into totals.
                `knownRecipes` already have macros (name, kcal, carbG, proteinG, fatG) — do NOT re-estimate or add them into totals;
                mention them in the review if useful.
                Request:
                %s
                """.formatted(requestJson);

        String path = "/v1beta/models/" + properties.model() + ":generateContent";
        JsonNode body = restClient.post()
                .uri(uriBuilder -> uriBuilder
                        .path(path)
                        .queryParam("key", properties.apiKey())
                        .build())
                .contentType(MediaType.APPLICATION_JSON)
                .body(new GeminiGenerateContentBody(
                        List.of(new GeminiContent(List.of(new GeminiPart(prompt)))),
                        new GeminiGenerationConfig("application/json")))
                .retrieve()
                .body(JsonNode.class);

        if (body == null) {
            throw new BusinessException(HttpStatus.BAD_GATEWAY, "Gemini 응답이 비었습니다.");
        }
        String text = extractText(body);
        try {
            JsonNode parsed = objectMapper.readTree(text);
            JsonNode totals = parsed.path("totals");
            if (!parsed.path("schemaVersion").isInt() || parsed.path("schemaVersion").asInt() != 1
                    || !request.loggedOn().toString().equals(parsed.path("loggedOn").asString(null))
                    || !parsed.path("oneLineReview").isString()
                    || parsed.path("oneLineReview").asString("").isBlank()) {
                throw new IllegalArgumentException("Invalid analysis response");
            }
            for (String field : List.of("carbG", "proteinG", "fatG", "kcal")) {
                JsonNode value = totals.path(field);
                if (!value.isNumber()) throw new IllegalArgumentException("Missing nutrition value");
                BigDecimal number = new BigDecimal(value.toString());
                if (number.signum() < 0 || number.compareTo(new BigDecimal("999999.9")) > 0
                        || (field.equals("kcal") && number.stripTrailingZeros().scale() > 0)) {
                    throw new IllegalArgumentException("Invalid nutrition value");
                }
            }
            return objectMapper.readValue(text, DietaGeminiMealResponse.class);
        } catch (JacksonException ex) {
            throw new BusinessException(HttpStatus.BAD_GATEWAY, "Gemini 응답을 파싱할 수 없습니다.");
        }
    }

    private static String extractText(JsonNode body) {
        JsonNode candidates = body.get("candidates");
        if (candidates == null || !candidates.isArray() || candidates.isEmpty()) {
            throw new BusinessException(HttpStatus.BAD_GATEWAY, "Gemini candidates 없음");
        }
        JsonNode parts = candidates.get(0).path("content").path("parts");
        if (!parts.isArray() || parts.isEmpty()) {
            throw new BusinessException(HttpStatus.BAD_GATEWAY, "Gemini parts 없음");
        }
        String text = parts.get(0).path("text").asString(null);
        if (text == null || text.isBlank()) {
            throw new BusinessException(HttpStatus.BAD_GATEWAY, "Gemini text 없음");
        }
        return text.strip();
    }

    private record GeminiGenerateContentBody(
            List<GeminiContent> contents,
            GeminiGenerationConfig generationConfig
    ) {
    }

    private record GeminiContent(List<GeminiPart> parts) {
    }

    private record GeminiPart(String text) {
    }

    private record GeminiGenerationConfig(String responseMimeType) {
    }
}
