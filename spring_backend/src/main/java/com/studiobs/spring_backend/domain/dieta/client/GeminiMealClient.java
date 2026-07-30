package com.studiobs.spring_backend.domain.dieta.client;

import com.studiobs.spring_backend.domain.dieta.config.DietaGeminiProperties;
import com.studiobs.spring_backend.domain.dieta.dto.gemini.DietaGeminiMealRequest;
import com.studiobs.spring_backend.domain.dieta.dto.gemini.DietaGeminiMealRequest.ActivityHint;
import com.studiobs.spring_backend.domain.dieta.dto.gemini.DietaGeminiMealRequest.GoalHint;
import com.studiobs.spring_backend.domain.dieta.dto.gemini.DietaGeminiMealResponse;
import com.studiobs.spring_backend.domain.dieta.dto.gemini.DietaGeminiMealResponse.Totals;
import com.studiobs.spring_backend.domain.dieta.support.DietaGeminiRequestBuilder;
import com.studiobs.spring_backend.domain.dieta.support.DietaMath;
import com.studiobs.spring_backend.global.exception.BusinessException;
import java.math.BigDecimal;
import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/**
 * Gemini meal finalize client. Without {@code dieta.gemini.api-key}, uses a deterministic stub
 * that still honors {@code estimateActivityKcalIfMissing} / {@code missingAmountAsOneServing}.
 */
@Slf4j
@Component
public class GeminiMealClient {

    private static final Pattern GRAMS = Pattern.compile("(\\d+(?:\\.\\d+)?)\\s*g", Pattern.CASE_INSENSITIVE);
    private static final Pattern BARE_NUMBER = Pattern.compile("(\\d+(?:\\.\\d+)?)");
    private static final Pattern ONE_SERVING = Pattern.compile("한\\s*그릇|한그릇|사발|공기|1인분|한\\s*인분");

    private final DietaGeminiProperties properties;
    private final ObjectMapper objectMapper;
    private final RestClient restClient;

    public GeminiMealClient(DietaGeminiProperties properties, ObjectMapper objectMapper) {
        this.properties = properties;
        this.objectMapper = objectMapper;
        this.restClient = RestClient.builder()
                .baseUrl(properties.baseUrl())
                .build();
    }

    public DietaGeminiMealResponse analyze(DietaGeminiMealRequest request) {
        if (!properties.hasApiKey()) {
            return stubAnalyze(request);
        }
        try {
            return callGemini(request);
        } catch (Exception ex) {
            log.warn("[DietaGemini] live call failed, falling back to stub: {}", ex.getMessage());
            return stubAnalyze(request);
        }
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

    /** Deterministic offline stub — mirrors FE dietaGeminiStub. */
    DietaGeminiMealResponse stubAnalyze(DietaGeminiMealRequest request) {
        List<String> allTexts = request.meals().stream()
                .flatMap(m -> m.items().stream())
                .toList();

        double carb = 0;
        double protein = 0;
        double fat = 0;
        boolean missingAsOneServing = request.instructions().missingAmountAsOneServing();

        for (String text : allTexts) {
            String t = text.toLowerCase(Locale.ROOT);
            double estG = estimatePortionG(text, missingAsOneServing);
            if (containsAny(t, "닭", "계란", "달걀", "연어", "두부", "고기")) {
                protein += estG * 0.22;
                fat += estG * 0.08;
                carb += estG * 0.02;
            } else if (containsAny(t, "밥", "면", "빵", "토스트", "고구마", "바나나")) {
                carb += estG * 0.28;
                protein += estG * 0.04;
                fat += estG * 0.02;
            } else if (containsAny(t, "아보카도", "기름", "치즈", "견과")) {
                fat += estG * 0.2;
                carb += estG * 0.05;
                protein += estG * 0.04;
            } else {
                carb += estG * 0.12;
                protein += estG * 0.08;
                fat += estG * 0.05;
            }
        }

        if (allTexts.isEmpty()) {
            carb = 0;
            protein = 0;
            fat = 0;
        }

        // Recipe analyze: ingredients are for N servings; return per-1-serving macros.
        boolean perServingOnly = Boolean.TRUE.equals(request.instructions().perServingOnly());
        BigDecimal batchServings = request.instructions().servings();
        double divisor = 1.0;
        if (perServingOnly && batchServings != null && batchServings.compareTo(BigDecimal.ZERO) > 0) {
            divisor = batchServings.doubleValue();
        }
        if (divisor > 0 && divisor != 1.0) {
            carb /= divisor;
            protein /= divisor;
            fat /= divisor;
        }

        BigDecimal carbG = DietaGeminiRequestBuilder.round1(carb);
        BigDecimal proteinG = DietaGeminiRequestBuilder.round1(protein);
        BigDecimal fatG = DietaGeminiRequestBuilder.round1(fat);
        int kcal = DietaMath.kcalFromMacros(
                carbG.doubleValue(), proteinG.doubleValue(), fatG.doubleValue());

        long mealCount = request.meals().stream().filter(m -> !m.items().isEmpty()).count();
        String review = buildReview(
                carbG.doubleValue(),
                proteinG.doubleValue(),
                fatG.doubleValue(),
                kcal,
                (int) mealCount,
                allTexts.size(),
                request.goalHint(),
                request.activityHint(),
                request.instructions().includeActivityInReview(),
                request.instructions().estimateActivityKcalIfMissing());

        return new DietaGeminiMealResponse(
                1,
                request.loggedOn(),
                new Totals(carbG, proteinG, fatG, kcal),
                review);
    }

    private static double estimatePortionG(String text, boolean missingAsOneServing) {
        Matcher withG = GRAMS.matcher(text);
        if (withG.find()) {
            return Math.min(Math.max(Double.parseDouble(withG.group(1)), 30), 800);
        }
        Matcher bare = BARE_NUMBER.matcher(text);
        if (bare.find()) {
            double n = Double.parseDouble(bare.group(1));
            if (n >= 20 && n <= 500) {
                return n;
            }
        }
        if (ONE_SERVING.matcher(text).find()) {
            return 350;
        }
        if (text.contains("개")) {
            return 100;
        }
        return missingAsOneServing ? 350 : 200;
    }

    private static boolean containsAny(String haystack, String... needles) {
        for (String n : needles) {
            if (haystack.contains(n)) {
                return true;
            }
        }
        return false;
    }

    private static int estimateBurnedKcal(int steps, int activeMinutes) {
        return (int) Math.round(steps * 0.04 + activeMinutes * 5.0);
    }

    private static Integer resolveActivityKcal(ActivityHint hint, boolean estimateIfMissing) {
        if (hint.activityKcal() != null) {
            return hint.activityKcal();
        }
        if (!estimateIfMissing) {
            return null;
        }
        if (hint.steps() <= 0 && hint.activeMinutes() <= 0) {
            return null;
        }
        return estimateBurnedKcal(hint.steps(), hint.activeMinutes());
    }

    private static String buildReview(
            double carbG,
            double proteinG,
            double fatG,
            int kcal,
            int mealCount,
            int itemCount,
            GoalHint goalHint,
            ActivityHint activityHint,
            boolean includeActivityInReview,
            boolean estimateActivityKcalIfMissing
    ) {
        if (itemCount == 0) {
            return "기록된 음식이 없어 분석을 건너뛰었어요.";
        }

        List<String> parts = new java.util.ArrayList<>();
        String goalType = goalHint.goalType();
        int maintainKcal = goalHint.maintainKcal();
        int dailyKcalTarget = goalHint.dailyKcalTarget();
        int vsMaintain = kcal - maintainKcal;
        int vsDaily = kcal - dailyKcalTarget;

        if ("LOSS".equals(goalType)) {
            if (vsDaily <= 50) {
                parts.add("목표 " + dailyKcalTarget + "kcal 대비 잘 맞췄어요");
            } else {
                parts.add("목표 " + dailyKcalTarget + "kcal보다 " + vsDaily + "kcal 높아요");
            }
            if (vsMaintain < -200) {
                parts.add("유지(" + maintainKcal + ")보다 적자라 감량 방향이에요");
            } else if (vsMaintain > 0) {
                parts.add("유지(" + maintainKcal + ")보다 많아 감량이 느려질 수 있어요");
            }
        } else if ("GAIN".equals(goalType)) {
            if (vsDaily >= -50) {
                parts.add("목표 " + dailyKcalTarget + "kcal 근처로 잘 채웠어요");
            } else {
                parts.add("목표 " + dailyKcalTarget + "kcal보다 " + (-vsDaily) + "kcal 부족해요");
            }
            if (vsMaintain > 100) {
                parts.add("유지(" + maintainKcal + ")보다 잉여라 증량에 유리해요");
            }
        } else {
            if (Math.abs(vsMaintain) <= 150) {
                parts.add("유지 " + maintainKcal + "kcal에 가깝게 먹었어요");
            } else if (vsMaintain > 0) {
                parts.add("유지(" + maintainKcal + ")보다 " + vsMaintain + "kcal 많아요");
            } else {
                parts.add("유지(" + maintainKcal + ")보다 " + (-vsMaintain) + "kcal 적어요");
            }
        }

        if (proteinG >= 80) {
            parts.add("단백질은 넉넉해요");
        } else if (proteinG < 40) {
            parts.add("단백질이 조금 부족한 편이에요");
        }

        if (carbG > proteinG * 2.5) {
            parts.add("탄수화물 비중이 높아요");
        } else if (fatG > 70) {
            parts.add("지방이 다소 많아요");
        }

        parts.add("총 " + kcal + "kcal · " + mealCount + "끼 " + itemCount + "항목");
        String review = String.join(". ", parts.subList(0, Math.min(3, parts.size())));
        if (parts.size() > 3) {
            review += ".";
        }

        if (includeActivityInReview) {
            Integer burned = resolveActivityKcal(activityHint, estimateActivityKcalIfMissing);
            if (burned != null && burned > 0) {
                int net = kcal - burned;
                boolean estimated = activityHint.activityKcal() == null;
                review += estimated
                        ? " 활동(추정 " + burned + "kcal) 반영하면 순 " + net + "kcal 느낌이에요."
                        : " 활동 " + burned + "kcal도 반영하면 순 " + net + "kcal 느낌이에요.";
            } else if (activityHint.steps() > 0 || activityHint.activeMinutes() > 0) {
                review += " 걸음 " + String.format(Locale.KOREA, "%,d", activityHint.steps())
                        + "보·활동 " + activityHint.activeMinutes() + "분도 참고했어요.";
            } else {
                review += " 활동 기록은 없어 섭취 위주로 봤어요.";
            }
        }

        return review;
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
