package com.studiobs.spring_backend.domain.dieta.service;

import com.studiobs.spring_backend.domain.dieta.client.GeminiMealClient;
import com.studiobs.spring_backend.domain.dieta.dto.DietaActivityLogResponse;
import com.studiobs.spring_backend.domain.dieta.dto.DietaActivityUpsertRequest;
import com.studiobs.spring_backend.domain.dieta.dto.DietaBodyLogResponse;
import com.studiobs.spring_backend.domain.dieta.dto.DietaBodyLogUpsertRequest;
import com.studiobs.spring_backend.domain.dieta.dto.DietaCheckInApplyRequest;
import com.studiobs.spring_backend.domain.dieta.dto.DietaCheckInApplyResponse;
import com.studiobs.spring_backend.domain.dieta.dto.DietaCheckInLogResponse;
import com.studiobs.spring_backend.domain.dieta.dto.DietaCheckInProposalRequest;
import com.studiobs.spring_backend.domain.dieta.dto.DietaIntakeLogResponse;
import com.studiobs.spring_backend.domain.dieta.dto.DietaKetoEventRequest;
import com.studiobs.spring_backend.domain.dieta.dto.DietaKetoEventResponse;
import com.studiobs.spring_backend.domain.dieta.dto.DietaMacroPercentsDto;
import com.studiobs.spring_backend.domain.dieta.dto.DietaMaintainModeRequest;
import com.studiobs.spring_backend.domain.dieta.dto.DietaOnboardingRequest;
import com.studiobs.spring_backend.domain.dieta.dto.DietaProfilePatchRequest;
import com.studiobs.spring_backend.domain.dieta.dto.DietaProfileResponse;
import com.studiobs.spring_backend.domain.dieta.dto.DietaWeekProposalResponse;
import com.studiobs.spring_backend.domain.dieta.dto.gemini.DietaGeminiMealRequest;
import com.studiobs.spring_backend.domain.dieta.dto.gemini.DietaGeminiMealResponse;
import com.studiobs.spring_backend.domain.dieta.dto.gemini.DietaGeminiMealRequest.KnownRecipe;
import com.studiobs.spring_backend.domain.dieta.dto.meal.DietaMealFinalizeResponse;
import com.studiobs.spring_backend.domain.dieta.dto.meal.DietaMealQueueAddItemRequest;
import com.studiobs.spring_backend.domain.dieta.dto.meal.DietaMealQueueDayResponse;
import com.studiobs.spring_backend.domain.dieta.dto.meal.DietaRecipeAddToDayRequest;
import com.studiobs.spring_backend.domain.dieta.dto.meal.DietaRecipeAnalyzeRequest;
import com.studiobs.spring_backend.domain.dieta.dto.meal.DietaRecipeAnalyzeResponse;
import com.studiobs.spring_backend.domain.dieta.dto.meal.DietaRecipeResponse;
import com.studiobs.spring_backend.domain.dieta.entity.DietaActivityLog;
import com.studiobs.spring_backend.domain.dieta.entity.DietaBodyLog;
import com.studiobs.spring_backend.domain.dieta.entity.DietaCheckInLog;
import com.studiobs.spring_backend.domain.dieta.entity.DietaIntakeLog;
import com.studiobs.spring_backend.domain.dieta.entity.DietaKetoEvent;
import com.studiobs.spring_backend.domain.dieta.entity.DietaProfile;
import com.studiobs.spring_backend.domain.dieta.entity.DietaRecipe;
import com.studiobs.spring_backend.domain.dieta.repository.DietaActivityLogRepository;
import com.studiobs.spring_backend.domain.dieta.repository.DietaBodyLogRepository;
import com.studiobs.spring_backend.domain.dieta.repository.DietaCheckInLogRepository;
import com.studiobs.spring_backend.domain.dieta.repository.DietaIntakeLogRepository;
import com.studiobs.spring_backend.domain.dieta.repository.DietaKetoEventRepository;
import com.studiobs.spring_backend.domain.dieta.repository.DietaProfileRepository;
import com.studiobs.spring_backend.domain.dieta.repository.DietaRecipeRepository;
import com.studiobs.spring_backend.domain.dieta.support.DietaGeminiRequestBuilder;
import com.studiobs.spring_backend.domain.dieta.support.DietaIntakeSourceDocument;
import com.studiobs.spring_backend.domain.dieta.support.DietaIntakeSourceDocument.MacroTotals;
import com.studiobs.spring_backend.domain.dieta.support.DietaMath;
import com.studiobs.spring_backend.domain.user.entity.User;
import com.studiobs.spring_backend.domain.user.service.UserService;
import com.studiobs.spring_backend.global.exception.BusinessException;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.ObjectMapper;

@Service
@RequiredArgsConstructor
public class DietaService {

    private final UserService userService;
    private final DietaProfileRepository profileRepository;
    private final DietaBodyLogRepository bodyLogRepository;
    private final DietaActivityLogRepository activityLogRepository;
    private final DietaKetoEventRepository ketoEventRepository;
    private final DietaCheckInLogRepository checkInLogRepository;
    private final DietaIntakeLogRepository intakeLogRepository;
    private final DietaRecipeRepository recipeRepository;
    private final DietaMealQueueRedisService mealQueueRedisService;
    private final GeminiMealClient geminiMealClient;
    private final ObjectMapper objectMapper;

    private static final Set<String> MEAL_TYPES = Set.of("BREAKFAST", "LUNCH", "DINNER", "SNACK");

    @Transactional(readOnly = true)
    public DietaProfileResponse getProfile(String email) {
        User user = requireUser(email);
        DietaProfile profile = profileRepository.findById(user.getId())
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "Dieta 프로필이 없습니다."));
        return toProfileResponse(profile);
    }

    @Transactional
    public DietaProfileResponse completeOnboarding(String email, DietaOnboardingRequest request) {
        User user = requireUser(email);
        if (profileRepository.existsById(user.getId())) {
            throw new BusinessException(HttpStatus.CONFLICT, "이미 온보딩이 완료되었습니다.");
        }

        boolean userEnteredBmr = request.bmrKcal() != null;
        int bmr = userEnteredBmr
                ? request.bmrKcal()
                : DietaMath.estimateBmrKcal(
                        request.weightKg(),
                        request.heightCm(),
                        request.ageYears(),
                        request.sex());
        int tdee = DietaMath.computeTdee(bmr, request.activityFactor());
        int daily = tdee;
        if ("LOSS".equals(request.goalType())) {
            daily = DietaMath.applyLossDaily(tdee - request.lossInitialDeficitKcal(), bmr);
        } else if ("GAIN".equals(request.goalType())) {
            daily = DietaMath.applyGainDaily(
                    tdee + request.gainInitialSurplusKcal(),
                    tdee,
                    request.gainCeilingDeltaKcal());
        }

        String lastNonMaintain = "GAIN".equals(request.goalType()) ? "GAIN" : "LOSS";
        BigDecimal weekly = request.weeklyTargetKg() != null ? request.weeklyTargetKg() : BigDecimal.ZERO;
        BigDecimal derived = DietaMath.deriveWeeklyEffective(weekly);
        BigDecimal weeklyFat = request.weeklyBodyFatLossKg();
        BigDecimal weeklyMuscle = request.weeklyMuscleGainKg();
        if ("LOSS".equals(request.goalType()) && weeklyFat == null) {
            weeklyFat = derived;
        }
        if ("GAIN".equals(request.goalType()) && weeklyMuscle == null) {
            weeklyMuscle = derived;
        }
        if ("MAINTAIN".equals(request.goalType())) {
            weekly = BigDecimal.ZERO;
            weeklyFat = null;
            weeklyMuscle = null;
            derived = null;
            daily = tdee;
        }

        LocalDate today = LocalDate.now();
        DietaProfile profile = DietaProfile.builder()
                .userId(user.getId())
                .heightCm(request.heightCm())
                .goalType(request.goalType())
                .lastNonMaintainGoalType(lastNonMaintain)
                .weeklyTargetKg(weekly)
                .targetWeightKg(request.targetWeightKg())
                .weeklyEffectiveKg(derived)
                .weeklyBodyFatLossKg(weeklyFat)
                .weeklyMuscleGainKg(weeklyMuscle)
                .intensityPreference(request.intensityPreference())
                .bmrKcal(bmr)
                .bmrSource(userEnteredBmr ? "USER_ENTERED" : "ESTIMATED")
                .activityFactor(request.activityFactor())
                .tdeeKcal(tdee)
                .dailyKcal(daily)
                .dietStyle(request.dietStyle())
                .macrosJson(serializeMacros(request.macros()))
                .macrosCustomized(request.macrosCustomized())
                .dietBaselineMethod("SURVEY")
                .lossInitialDeficitKcal(request.lossInitialDeficitKcal())
                .gainInitialSurplusKcal(request.gainInitialSurplusKcal())
                .lossCutKcal(request.lossCutKcal())
                .lossRecoverKcal(request.lossRecoverKcal())
                .lossActivityKcal(request.lossActivityKcal())
                .gainSurplusKcal(request.gainSurplusKcal())
                .gainCutKcal(request.gainCutKcal())
                .gainCeilingDeltaKcal(request.gainCeilingDeltaKcal())
                .geminiMealConsent(request.geminiMealConsent())
                .weekStartsOn(today)
                .weekActivityExtraKcal(0)
                .onboardingComplete(true)
                .build();

        profileRepository.save(profile);
        bodyLogRepository.save(DietaBodyLog.builder()
                .userId(user.getId())
                .loggedOn(today)
                .weightKg(request.weightKg())
                .bodyFatMassKg(request.bodyFatMassKg())
                .skeletalMuscleMassKg(request.skeletalMuscleMassKg())
                .fasted(true)
                .source("ONBOARDING")
                .build());

        return toProfileResponse(profile);
    }

    @Transactional
    public DietaProfileResponse patchProfile(String email, DietaProfilePatchRequest request) {
        User user = requireUser(email);
        DietaProfile profile = requireProfile(user.getId());
        profile.applyPatch(
                request.heightCm(),
                request.goalType(),
                request.lastNonMaintainGoalType(),
                request.weeklyTargetKg(),
                request.targetWeightKg(),
                null,
                request.weeklyBodyFatLossKg(),
                request.weeklyMuscleGainKg(),
                request.intensityPreference(),
                request.bmrKcal(),
                request.bmrSource(),
                request.activityFactor(),
                request.tdeeKcal(),
                request.dailyKcal(),
                request.dietStyle(),
                request.macros() != null ? serializeMacros(request.macros()) : null,
                request.macrosCustomized(),
                request.dietBaselineMethod(),
                request.lossInitialDeficitKcal(),
                request.gainInitialSurplusKcal(),
                request.lossCutKcal(),
                request.lossRecoverKcal(),
                request.lossActivityKcal(),
                request.gainSurplusKcal(),
                request.gainCutKcal(),
                request.gainCeilingDeltaKcal(),
                request.geminiMealConsent(),
                request.weekStartsOn(),
                request.weekActivityExtraKcal(),
                request.onboardingComplete()
        );
        return toProfileResponse(profileRepository.save(profile));
    }

    @Transactional
    public DietaProfileResponse setMaintainMode(String email, DietaMaintainModeRequest request) {
        User user = requireUser(email);
        DietaProfile profile = requireProfile(user.getId());

        String last = profile.getLastNonMaintainGoalType();
        if (last == null || (!"LOSS".equals(last) && !"GAIN".equals(last))) {
            last = "GAIN".equals(profile.getGoalType()) ? "GAIN" : "LOSS";
        }

        if (Boolean.TRUE.equals(request.enabled())) {
            if ("MAINTAIN".equals(profile.getGoalType())) {
                return toProfileResponse(profile);
            }
            String remember = "LOSS".equals(profile.getGoalType()) || "GAIN".equals(profile.getGoalType())
                    ? profile.getGoalType()
                    : last;
            profile.enterMaintainMode(remember, profile.getTdeeKcal());
            return toProfileResponse(profileRepository.save(profile));
        }

        if (!"MAINTAIN".equals(profile.getGoalType())) {
            return toProfileResponse(profile);
        }

        BigDecimal weekly = DietaMath.resolveWeeklyTarget(profile.getWeeklyTargetKg());
        BigDecimal derived = DietaMath.deriveWeeklyEffective(weekly);
        int daily;
        BigDecimal weeklyFat = null;
        BigDecimal weeklyMuscle = null;
        if ("LOSS".equals(last)) {
            weeklyFat = derived;
            daily = DietaMath.applyLossDaily(
                    profile.getTdeeKcal() - profile.getLossInitialDeficitKcal(),
                    profile.getBmrKcal());
        } else {
            weeklyMuscle = derived;
            daily = DietaMath.applyGainDaily(
                    profile.getTdeeKcal() + profile.getGainInitialSurplusKcal(),
                    profile.getTdeeKcal(),
                    profile.getGainCeilingDeltaKcal());
        }
        profile.leaveMaintainMode(last, weekly, weeklyFat, weeklyMuscle, derived, daily);
        return toProfileResponse(profileRepository.save(profile));
    }

    @Transactional(readOnly = true)
    public List<DietaBodyLogResponse> listBodyLogs(String email) {
        User user = requireUser(email);
        return bodyLogRepository.findByUserIdOrderByLoggedOnAsc(user.getId()).stream()
                .map(DietaBodyLogResponse::from)
                .toList();
    }

    @Transactional
    public DietaBodyLogResponse upsertBodyLog(String email, DietaBodyLogUpsertRequest request) {
        User user = requireUser(email);
        requireProfile(user.getId());
        DietaBodyLog log = bodyLogRepository.findByUserIdAndLoggedOn(user.getId(), request.loggedOn())
                .map(existing -> {
                    existing.update(
                            request.weightKg(),
                            request.bodyFatMassKg(),
                            request.skeletalMuscleMassKg(),
                            request.fasted(),
                            request.source());
                    return existing;
                })
                .orElseGet(() -> DietaBodyLog.builder()
                        .userId(user.getId())
                        .loggedOn(request.loggedOn())
                        .weightKg(request.weightKg())
                        .bodyFatMassKg(request.bodyFatMassKg())
                        .skeletalMuscleMassKg(request.skeletalMuscleMassKg())
                        .fasted(request.fasted())
                        .source(request.source())
                        .build());
        return DietaBodyLogResponse.from(bodyLogRepository.save(log));
    }

    @Transactional(readOnly = true)
    public List<DietaActivityLogResponse> listActivities(String email) {
        User user = requireUser(email);
        return activityLogRepository.findByUserIdOrderByLoggedOnAsc(user.getId()).stream()
                .map(DietaActivityLogResponse::from)
                .toList();
    }

    @Transactional
    public DietaActivityLogResponse upsertActivity(String email, DietaActivityUpsertRequest request) {
        User user = requireUser(email);
        requireProfile(user.getId());
        DietaActivityLog log = activityLogRepository
                .findByUserIdAndLoggedOn(user.getId(), request.loggedOn())
                .map(existing -> {
                    existing.update(
                            request.steps(),
                            request.durationMin(),
                            request.activityKcal(),
                            request.note());
                    return existing;
                })
                .orElseGet(() -> DietaActivityLog.builder()
                        .userId(user.getId())
                        .loggedOn(request.loggedOn())
                        .steps(request.steps())
                        .durationMin(request.durationMin())
                        .activityKcal(request.activityKcal())
                        .note(request.note())
                        .build());
        return DietaActivityLogResponse.from(activityLogRepository.save(log));
    }

    @Transactional(readOnly = true)
    public List<DietaKetoEventResponse> listKetoEvents(String email) {
        User user = requireUser(email);
        return ketoEventRepository.findByUserIdOrderByRecordedAtDesc(user.getId()).stream()
                .map(DietaKetoEventResponse::from)
                .toList();
    }

    @Transactional
    public DietaKetoEventResponse recordKeto(String email, DietaKetoEventRequest request) {
        User user = requireUser(email);
        requireProfile(user.getId());
        DietaKetoEvent saved = ketoEventRepository.save(DietaKetoEvent.builder()
                .userId(user.getId())
                .easeRequested(Boolean.TRUE.equals(request.easeRequested()))
                .build());
        return DietaKetoEventResponse.from(saved);
    }

    @Transactional(readOnly = true)
    public List<DietaCheckInLogResponse> listCheckIns(String email) {
        User user = requireUser(email);
        return checkInLogRepository.findByUserIdOrderByLoggedOnAsc(user.getId()).stream()
                .map(DietaCheckInLogResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public DietaMealQueueDayResponse getMealQueue(String email, LocalDate loggedOn) {
        User user = requireUser(email);
        requireProfile(user.getId());
        return mealQueueRedisService.getOrEmpty(user.getId(), loggedOn);
    }

    @Transactional(readOnly = true)
    public List<DietaIntakeLogResponse> listIntakes(String email, LocalDate loggedOn) {
        User user = requireUser(email);
        requireProfile(user.getId());
        if (loggedOn != null) {
            return intakeLogRepository.findByUserIdAndLoggedOn(user.getId(), loggedOn).stream()
                    .map(DietaIntakeLogResponse::from)
                    .toList();
        }
        return intakeLogRepository.findByUserIdOrderByLoggedOnAsc(user.getId()).stream()
                .map(DietaIntakeLogResponse::from)
                .toList();
    }

    public DietaMealQueueDayResponse addMealQueueItem(String email, DietaMealQueueAddItemRequest request) {
        User user = requireUser(email);
        requireProfile(user.getId());
        String mealType = request.mealType().trim().toUpperCase();
        if (!MEAL_TYPES.contains(mealType)) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "잘못된 끼니 유형입니다.");
        }
        String text = request.text().trim();
        if (text.isEmpty()) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "내용을 입력해 주세요.");
        }

        DietaMealQueueDayResponse queue = mealQueueRedisService.getOrEmpty(user.getId(), request.loggedOn());
        if ("done".equals(queue.status())) {
            throw new BusinessException(HttpStatus.CONFLICT, "이미 마감·분석된 날이에요.");
        }
        DietaMealQueueDayResponse next = mealQueueRedisService.addItem(queue, mealType, text);
        return mealQueueRedisService.save(user.getId(), next);
    }

    public DietaMealQueueDayResponse removeMealQueueItem(String email, LocalDate loggedOn, String itemId) {
        User user = requireUser(email);
        requireProfile(user.getId());
        DietaMealQueueDayResponse queue = mealQueueRedisService.getOrEmpty(user.getId(), loggedOn);
        DietaMealQueueDayResponse next = mealQueueRedisService.removeItem(queue, itemId);
        return mealQueueRedisService.save(user.getId(), next);
    }

    @Transactional(readOnly = true)
    public List<DietaRecipeResponse> listRecipes(String email, LocalDate loggedOn) {
        User user = requireUser(email);
        requireProfile(user.getId());
        List<DietaRecipe> recipes =
                loggedOn != null
                        ? recipeRepository.findByUserIdAndLoggedOnOrderByCreatedAtAsc(
                                user.getId(), loggedOn)
                        : recipeRepository.findTop100ByUserIdOrderByCreatedAtDescIdDesc(user.getId());
        return recipes.stream().map(this::toRecipeResponse).toList();
    }

    @Transactional
    public DietaRecipeAnalyzeResponse analyzeRecipe(String email, DietaRecipeAnalyzeRequest request) {
        User user = requireUser(email);
        DietaProfile profile = requireProfile(user.getId());
        if (!profile.isGeminiMealConsent()) {
            throw new BusinessException(
                    HttpStatus.FORBIDDEN,
                    "식단 AI 분석 동의가 필요해요. 설정에서 켜 주세요.");
        }

        BigDecimal servings = request.servings();
        if (servings == null || servings.compareTo(BigDecimal.ZERO) <= 0) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "인분 수는 0보다 커야 해요.");
        }
        String title = request.title().trim();
        if (title.isEmpty()) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "레시피 제목을 입력해 주세요.");
        }
        List<String> ingredients = request.ingredients().stream()
                .filter(s -> s != null && !s.isBlank())
                .map(String::trim)
                .toList();
        if (ingredients.isEmpty()) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "재료를 한 줄 이상 입력해 주세요.");
        }
        String steps = request.steps() == null || request.steps().isBlank()
                ? null
                : request.steps().trim();

        // mealType omitted on create — chosen later at add-to-day on the day copy.
        DietaGeminiMealRequest geminiRequest = DietaGeminiRequestBuilder.buildRecipe(
                request.loggedOn(), title, ingredients, steps, servings, profile);
        DietaGeminiMealResponse geminiResponse = geminiMealClient.analyze(geminiRequest);

        // Gemini returns per-1-serving macros when perServingOnly is set.
        BigDecimal carbG = geminiResponse.totals().carbG();
        BigDecimal proteinG = geminiResponse.totals().proteinG();
        BigDecimal fatG = geminiResponse.totals().fatG();
        int kcal = geminiResponse.totals().kcal();
        if (kcal <= 0) {
            kcal = DietaMath.kcalFromMacros(
                    carbG.doubleValue(), proteinG.doubleValue(), fatG.doubleValue());
        }

        String ingredientsJson;
        try {
            ingredientsJson = objectMapper.writeValueAsString(ingredients);
        } catch (JacksonException ex) {
            throw new BusinessException(HttpStatus.INTERNAL_SERVER_ERROR, "재료 목록을 저장할 수 없습니다.");
        }

        DietaRecipe savedRecipe = recipeRepository.save(DietaRecipe.builder()
                .userId(user.getId())
                .loggedOn(request.loggedOn())
                .mealType(null)
                .title(title)
                .ingredientsJson(ingredientsJson)
                .steps(steps)
                .carbG(carbG)
                .proteinG(proteinG)
                .fatG(fatG)
                .kcal(kcal)
                .oneLineReview(geminiResponse.oneLineReview())
                .servings(servings)
                .build());

        List<DietaRecipe> dayRecipes = recipeRepository
                .findByUserIdAndLoggedOnOrderByCreatedAtAsc(user.getId(), request.loggedOn());
        MacroTotals recipeSum = sumRecipeMacros(dayRecipes);

        DietaIntakeLog intake = upsertIntakeWithRecipe(
                user.getId(),
                request.loggedOn(),
                savedRecipe.getId().toString(),
                recipeSum,
                geminiResponse.oneLineReview());

        return new DietaRecipeAnalyzeResponse(
                savedRecipe.getId().toString(),
                carbG,
                proteinG,
                fatG,
                kcal,
                geminiResponse.oneLineReview(),
                savedRecipe.getServings(),
                DietaIntakeLogResponse.from(intake));
    }

    /**
     * Copy an existing recipe's macros into a new day-scoped row and merge into intake.
     * No Gemini call — does not require {@code geminiMealConsent}.
     */
    @Transactional
    public DietaRecipeAnalyzeResponse addRecipeToDay(
            String email,
            UUID recipeId,
            DietaRecipeAddToDayRequest request
    ) {
        User user = requireUser(email);
        requireProfile(user.getId());

        DietaRecipe source = recipeRepository.findById(recipeId)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "레시피를 찾을 수 없어요."));
        if (!source.getUserId().equals(user.getId())) {
            throw new BusinessException(HttpStatus.NOT_FOUND, "레시피를 찾을 수 없어요.");
        }

        String mealType;
        if (request.mealType() != null && !request.mealType().isBlank()) {
            mealType = request.mealType().trim().toUpperCase();
            if (!MEAL_TYPES.contains(mealType)) {
                throw new BusinessException(HttpStatus.BAD_REQUEST, "잘못된 끼니 유형입니다.");
            }
        } else if (source.getMealType() != null && !source.getMealType().isBlank()) {
            mealType = source.getMealType();
        } else {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "끼니 유형을 선택해 주세요.");
        }

        // Copy 1인분 (per-serving) macros into the day row.
        DietaRecipe savedRecipe = recipeRepository.save(DietaRecipe.builder()
                .userId(user.getId())
                .loggedOn(request.loggedOn())
                .mealType(mealType)
                .title(source.getTitle())
                .ingredientsJson(source.getIngredientsJson())
                .steps(source.getSteps())
                .carbG(source.getCarbG())
                .proteinG(source.getProteinG())
                .fatG(source.getFatG())
                .kcal(source.getKcal())
                .oneLineReview(source.getOneLineReview())
                .servings(source.getServings() == null ? BigDecimal.ONE : source.getServings())
                .build());

        List<DietaRecipe> dayRecipes = recipeRepository
                .findByUserIdAndLoggedOnOrderByCreatedAtAsc(user.getId(), request.loggedOn());
        MacroTotals recipeSum = sumRecipeMacros(dayRecipes);

        String review = source.getOneLineReview() != null
                ? source.getOneLineReview()
                : "등록 레시피를 오늘 섭취에 더했어요.";

        DietaIntakeLog intake = upsertIntakeWithRecipe(
                user.getId(),
                request.loggedOn(),
                savedRecipe.getId().toString(),
                recipeSum,
                review);

        return new DietaRecipeAnalyzeResponse(
                savedRecipe.getId().toString(),
                savedRecipe.getCarbG(),
                savedRecipe.getProteinG(),
                savedRecipe.getFatG(),
                savedRecipe.getKcal(),
                savedRecipe.getOneLineReview(),
                savedRecipe.getServings(),
                DietaIntakeLogResponse.from(intake));
    }

    private DietaIntakeLog upsertIntakeWithRecipe(
            UUID userId,
            LocalDate loggedOn,
            String recipeId,
            MacroTotals recipeSum,
            String review
    ) {
        DietaIntakeLog existing = intakeLogRepository
                .findByUserIdAndLoggedOn(userId, loggedOn)
                .orElse(null);
        DietaIntakeSourceDocument source = existing == null
                ? DietaIntakeSourceDocument.empty()
                : DietaIntakeSourceDocument.parse(objectMapper, existing.getSourceMealsJson());
        source = source.withAppendedRecipeId(recipeId);
        MacroTotals combined = source.combinedWithRecipeSum(recipeSum);

        String sourceJson;
        try {
            sourceJson = source.write(objectMapper);
        } catch (JacksonException ex) {
            throw new BusinessException(HttpStatus.INTERNAL_SERVER_ERROR, "레시피 스냅샷을 저장할 수 없습니다.");
        }

        if (existing != null) {
            existing.update(
                    combined.carbG(),
                    combined.proteinG(),
                    combined.fatG(),
                    combined.kcal(),
                    review,
                    sourceJson);
            return intakeLogRepository.save(existing);
        }
        return intakeLogRepository.save(DietaIntakeLog.builder()
                .userId(userId)
                .loggedOn(loggedOn)
                .carbG(combined.carbG())
                .proteinG(combined.proteinG())
                .fatG(combined.fatG())
                .kcal(combined.kcal())
                .review(review)
                .sourceMealsJson(sourceJson)
                .build());
    }

    @Transactional
    public DietaMealFinalizeResponse finalizeMealDay(String email, LocalDate loggedOn) {
        User user = requireUser(email);
        DietaProfile profile = requireProfile(user.getId());
        if (!profile.isGeminiMealConsent()) {
            throw new BusinessException(
                    HttpStatus.FORBIDDEN,
                    "식단 AI 분석 동의가 필요해요. 설정에서 켜 주세요.");
        }

        DietaMealQueueDayResponse queue = mealQueueRedisService.getOrEmpty(user.getId(), loggedOn);
        if (queue.items() == null || queue.items().isEmpty()) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "오늘 큐가 비어 있어요.");
        }

        if ("done".equals(queue.status())) {
            DietaIntakeLog existing = intakeLogRepository
                    .findByUserIdAndLoggedOn(user.getId(), loggedOn)
                    .orElse(null);
            if (existing != null) {
                return new DietaMealFinalizeResponse(DietaIntakeLogResponse.from(existing), queue);
            }
        }

        DietaMealQueueDayResponse pending = mealQueueRedisService.withStatus(queue, "pending");
        mealQueueRedisService.save(user.getId(), pending);

        try {
            DietaActivityLog activity = activityLogRepository
                    .findByUserIdAndLoggedOn(user.getId(), loggedOn)
                    .orElse(null);
            List<DietaRecipe> dayRecipes = recipeRepository
                    .findByUserIdAndLoggedOnOrderByCreatedAtAsc(user.getId(), loggedOn);
            List<KnownRecipe> knownRecipes = DietaGeminiRequestBuilder.toKnownRecipes(dayRecipes);
            // Queue items only in meals[]; knownRecipes carry pre-analyzed macros (no double-count).
            DietaGeminiMealRequest geminiRequest = DietaGeminiRequestBuilder.build(
                    loggedOn, pending.items(), profile, activity, knownRecipes);
            DietaGeminiMealResponse geminiResponse = geminiMealClient.analyze(geminiRequest);

            BigDecimal queueCarb = geminiResponse.totals().carbG();
            BigDecimal queueProtein = geminiResponse.totals().proteinG();
            BigDecimal queueFat = geminiResponse.totals().fatG();
            int queueKcal = geminiResponse.totals().kcal();
            if (queueKcal <= 0) {
                queueKcal = DietaMath.kcalFromMacros(
                        queueCarb.doubleValue(), queueProtein.doubleValue(), queueFat.doubleValue());
            }
            MacroTotals queueTotals = new MacroTotals(queueCarb, queueProtein, queueFat, queueKcal);
            MacroTotals recipeSum = sumRecipeMacros(dayRecipes);

            DietaIntakeLog existing = intakeLogRepository
                    .findByUserIdAndLoggedOn(user.getId(), loggedOn)
                    .orElse(null);
            DietaIntakeSourceDocument prior = existing == null
                    ? DietaIntakeSourceDocument.empty()
                    : DietaIntakeSourceDocument.parse(objectMapper, existing.getSourceMealsJson());
            if (dayRecipes.isEmpty() && !prior.analyzedRecipes().isEmpty()) {
                recipeSum = prior.legacyRecipeMacroSum();
            }
            List<String> recipeIds = dayRecipes.isEmpty()
                    ? prior.recipeIds()
                    : dayRecipes.stream().map(r -> r.getId().toString()).toList();
            DietaIntakeSourceDocument source = prior.withQueueFinalize(
                    DietaGeminiRequestBuilder.snapshotOf(geminiRequest),
                    queueTotals,
                    recipeIds,
                    knownRecipes.isEmpty() && !prior.analyzedRecipes().isEmpty()
                            ? prior.analyzedRecipes().stream()
                                    .map(r -> new KnownRecipe(
                                            r.title(), r.kcal(), r.carbG(), r.proteinG(), r.fatG()))
                                    .toList()
                            : knownRecipes);
            MacroTotals combined = source.combinedWithRecipeSum(recipeSum);

            String sourceJson;
            try {
                sourceJson = source.write(objectMapper);
            } catch (JacksonException ex) {
                throw new BusinessException(HttpStatus.INTERNAL_SERVER_ERROR, "식사 스냅샷을 저장할 수 없습니다.");
            }

            String dayReview = geminiResponse.oneLineReview();
            int recipeCount = dayRecipes.isEmpty()
                    ? prior.analyzedRecipes().size()
                    : dayRecipes.size();
            if (recipeCount > 0) {
                dayReview = "레시피 " + recipeCount + "건 포함. " + dayReview;
            }

            DietaIntakeLog intake;
            if (existing != null) {
                existing.update(
                        combined.carbG(),
                        combined.proteinG(),
                        combined.fatG(),
                        combined.kcal(),
                        dayReview,
                        sourceJson);
                intake = intakeLogRepository.save(existing);
            } else {
                intake = intakeLogRepository.save(DietaIntakeLog.builder()
                        .userId(user.getId())
                        .loggedOn(loggedOn)
                        .carbG(combined.carbG())
                        .proteinG(combined.proteinG())
                        .fatG(combined.fatG())
                        .kcal(combined.kcal())
                        .review(dayReview)
                        .sourceMealsJson(sourceJson)
                        .build());
            }

            DietaMealQueueDayResponse done = mealQueueRedisService.withStatus(pending, "done");
            done = mealQueueRedisService.save(user.getId(), done);
            return new DietaMealFinalizeResponse(DietaIntakeLogResponse.from(intake), done);
        } catch (BusinessException ex) {
            mealQueueRedisService.save(user.getId(), mealQueueRedisService.withStatus(pending, "failed"));
            throw ex;
        } catch (RuntimeException ex) {
            mealQueueRedisService.save(user.getId(), mealQueueRedisService.withStatus(pending, "failed"));
            throw new BusinessException(HttpStatus.BAD_GATEWAY, "식단 분석에 실패했어요.");
        }
    }

    @Transactional
    public DietaMealFinalizeResponse autoFinalizeYesterday(String email) {
        User user = requireUser(email);
        DietaProfile profile = requireProfile(user.getId());
        LocalDate yesterday = LocalDate.now().minusDays(1);
        DietaMealQueueDayResponse queue = mealQueueRedisService.getOrEmpty(user.getId(), yesterday);
        if (queue.items() == null || queue.items().isEmpty() || "done".equals(queue.status())) {
            return null;
        }
        if (!profile.isGeminiMealConsent()) {
            return null;
        }
        return finalizeMealDay(email, yesterday);
    }

    @Transactional(readOnly = true)
    public DietaWeekProposalResponse proposeCheckIn(String email, DietaCheckInProposalRequest request) {
        User user = requireUser(email);
        DietaProfile profile = requireProfile(user.getId());
        CheckInContext ctx = buildCheckInContext(
                profile,
                user.getId(),
                request.loggedOn(),
                request.weightKg(),
                request.plateauChoice(),
                request.avgIntakeKcal(),
                request.intakeDays());
        return toProposalResponse(ctx);
    }

    @Transactional
    public DietaCheckInApplyResponse applyCheckIn(String email, DietaCheckInApplyRequest request) {
        User user = requireUser(email);
        DietaProfile profile = requireProfile(user.getId());
        CheckInContext ctx = buildCheckInContext(
                profile,
                user.getId(),
                request.loggedOn(),
                request.weightKg(),
                request.plateauChoice(),
                request.avgIntakeKcal(),
                request.intakeDays());

        upsertCheckInBodyLog(user.getId(), request.loggedOn(), request.weightKg());

        boolean reached = ctx.targetReached();
        boolean keepTargets = !reached && request.keepTargets();
        DietaMath.WeekProposal proposal = ctx.proposal();

        if (reached) {
            String remember = "LOSS".equals(profile.getGoalType()) || "GAIN".equals(profile.getGoalType())
                    ? profile.getGoalType()
                    : (profile.getLastNonMaintainGoalType() != null
                            ? profile.getLastNonMaintainGoalType()
                            : "LOSS");
            profile.enterMaintainMode(remember, proposal.proposedTdee());
            profile.setWeekStartsOn(request.loggedOn());
        } else if (keepTargets) {
            profile.applyCheckInKeepTargets(proposal.proposedTdee(), request.loggedOn());
        } else {
            profile.applyCheckInAdjust(
                    proposal.proposedTdee(),
                    proposal.proposedDailyKcal(),
                    proposal.proposedActivityExtraKcal(),
                    request.loggedOn());
        }

        profile = profileRepository.save(profile);

        final int appliedDaily = profile.getDailyKcal();
        final int appliedActivity = profile.getWeekActivityExtraKcal();
        final BigDecimal appliedWeekly = profile.getWeeklyTargetKg();

        DietaCheckInLog checkIn = checkInLogRepository
                .findByUserIdAndLoggedOn(user.getId(), request.loggedOn())
                .map(existing -> {
                    existing.update(
                            request.weightKg(),
                            ctx.baselineWeightKg(),
                            ctx.weightDeltaKg(),
                            keepTargets,
                            appliedDaily,
                            appliedActivity,
                            appliedWeekly);
                    return existing;
                })
                .orElseGet(() -> DietaCheckInLog.builder()
                        .userId(user.getId())
                        .loggedOn(request.loggedOn())
                        .weightKg(request.weightKg())
                        .baselineWeightKg(ctx.baselineWeightKg())
                        .weightDeltaKg(ctx.weightDeltaKg())
                        .keepTargets(keepTargets)
                        .appliedDailyKcal(appliedDaily)
                        .appliedActivityExtraKcal(appliedActivity)
                        .appliedWeeklyTargetKg(appliedWeekly)
                        .build());
        checkIn = checkInLogRepository.save(checkIn);

        return new DietaCheckInApplyResponse(
                toProfileResponse(profile),
                DietaCheckInLogResponse.from(checkIn),
                toProposalResponse(ctx));
    }

    private CheckInContext buildCheckInContext(
            DietaProfile profile,
            UUID userId,
            LocalDate loggedOn,
            BigDecimal weightKg,
            String plateauChoice,
            Integer avgIntakeKcal,
            Integer intakeDays
    ) {
        DietaBodyLog baseline = findCheckInBaseline(userId, loggedOn);
        BigDecimal baselineWeight = baseline != null ? baseline.getWeightKg() : null;
        BigDecimal weightDelta = baselineWeight != null
                ? weightKg.subtract(baselineWeight)
                : null;

        int avg = avgIntakeKcal != null ? avgIntakeKcal : 0;
        int days = intakeDays != null ? intakeDays : 0;
        String choice = plateauChoice != null ? plateauChoice : "CUT_KCAL";

        DietaMath.WeekProposal proposal = DietaMath.buildWeeklyCheckInProposal(
                new DietaMath.WeekProposalInput(
                        profile.getGoalType(),
                        profile.getWeeklyTargetKg(),
                        profile.getDailyKcal(),
                        profile.getTdeeKcal(),
                        profile.getBmrKcal(),
                        profile.getLossCutKcal(),
                        profile.getLossRecoverKcal(),
                        profile.getLossActivityKcal(),
                        profile.getGainSurplusKcal(),
                        profile.getGainCutKcal(),
                        profile.getGainCeilingDeltaKcal(),
                        avg,
                        days,
                        weightDelta,
                        null,
                        null,
                        choice));

        boolean due = DietaMath.isWeeklyCheckInDue(profile.getWeekStartsOn(), loggedOn);
        boolean reached = DietaMath.hasReachedTargetWeight(
                profile.getGoalType(), weightKg, profile.getTargetWeightKg());

        return new CheckInContext(
                weightKg,
                baselineWeight,
                weightDelta,
                proposal,
                profile.getWeekStartsOn(),
                due,
                reached);
    }

    private DietaWeekProposalResponse toProposalResponse(CheckInContext ctx) {
        return DietaWeekProposalResponse.from(
                ctx.proposal(),
                ctx.baselineWeightKg(),
                ctx.checkInWeightKg(),
                ctx.weekStartsOn(),
                ctx.due(),
                ctx.targetReached());
    }

    private void upsertCheckInBodyLog(UUID userId, LocalDate loggedOn, BigDecimal weightKg) {
        DietaBodyLog log = bodyLogRepository.findByUserIdAndLoggedOn(userId, loggedOn)
                .map(existing -> {
                    existing.update(weightKg, null, null, true, "CHECK_IN");
                    return existing;
                })
                .orElseGet(() -> DietaBodyLog.builder()
                        .userId(userId)
                        .loggedOn(loggedOn)
                        .weightKg(weightKg)
                        .bodyFatMassKg(null)
                        .skeletalMuscleMassKg(null)
                        .fasted(true)
                        .source("CHECK_IN")
                        .build());
        bodyLogRepository.save(log);
    }

    private static MacroTotals sumRecipeMacros(List<DietaRecipe> recipes) {
        if (recipes == null || recipes.isEmpty()) {
            return MacroTotals.zero();
        }
        BigDecimal carb = BigDecimal.ZERO;
        BigDecimal protein = BigDecimal.ZERO;
        BigDecimal fat = BigDecimal.ZERO;
        int kcal = 0;
        for (DietaRecipe recipe : recipes) {
            carb = carb.add(recipe.getCarbG() == null ? BigDecimal.ZERO : recipe.getCarbG());
            protein = protein.add(recipe.getProteinG() == null ? BigDecimal.ZERO : recipe.getProteinG());
            fat = fat.add(recipe.getFatG() == null ? BigDecimal.ZERO : recipe.getFatG());
            kcal += Math.max(recipe.getKcal(), 0);
        }
        return new MacroTotals(
                DietaGeminiRequestBuilder.round1(carb.doubleValue()),
                DietaGeminiRequestBuilder.round1(protein.doubleValue()),
                DietaGeminiRequestBuilder.round1(fat.doubleValue()),
                kcal);
    }

    private DietaRecipeResponse toRecipeResponse(DietaRecipe recipe) {
        List<String> ingredients = List.of();
        if (recipe.getIngredientsJson() != null && !recipe.getIngredientsJson().isBlank()) {
            try {
                ingredients = objectMapper.readValue(
                        recipe.getIngredientsJson(),
                        objectMapper.getTypeFactory().constructCollectionType(List.class, String.class));
            } catch (RuntimeException ex) {
                ingredients = List.of();
            }
        }
        return new DietaRecipeResponse(
                recipe.getId(),
                recipe.getLoggedOn(),
                recipe.getMealType(),
                recipe.getTitle(),
                ingredients,
                recipe.getSteps(),
                recipe.getCarbG(),
                recipe.getProteinG(),
                recipe.getFatG(),
                recipe.getKcal(),
                recipe.getOneLineReview(),
                recipe.getServings() == null ? BigDecimal.ONE : recipe.getServings(),
                recipe.getCreatedAt());
    }

    private DietaBodyLog findCheckInBaseline(UUID userId, LocalDate beforeIso) {
        return bodyLogRepository.findByUserIdOrderByLoggedOnAsc(userId).stream()
                .filter(l -> l.getLoggedOn().isBefore(beforeIso)
                        && l.getWeightKg() != null
                        && ("CHECK_IN".equals(l.getSource()) || "ONBOARDING".equals(l.getSource())))
                .max(Comparator.comparing(DietaBodyLog::getLoggedOn))
                .orElse(null);
    }

    private record CheckInContext(
            BigDecimal checkInWeightKg,
            BigDecimal baselineWeightKg,
            BigDecimal weightDeltaKg,
            DietaMath.WeekProposal proposal,
            LocalDate weekStartsOn,
            boolean due,
            boolean targetReached
    ) {
    }

    private DietaProfileResponse toProfileResponse(DietaProfile profile) {
        return DietaProfileResponse.from(profile, parseMacros(profile.getMacrosJson()));
    }

    private String serializeMacros(DietaMacroPercentsDto macros) {
        try {
            return objectMapper.writeValueAsString(macros);
        } catch (JacksonException ex) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "매크로 JSON을 저장할 수 없습니다.");
        }
    }

    private DietaMacroPercentsDto parseMacros(String json) {
        try {
            return objectMapper.readValue(json, DietaMacroPercentsDto.class);
        } catch (JacksonException ex) {
            throw new BusinessException(HttpStatus.INTERNAL_SERVER_ERROR, "매크로 JSON을 읽을 수 없습니다.");
        }
    }

    private DietaProfile requireProfile(UUID userId) {
        return profileRepository.findById(userId)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "Dieta 프로필이 없습니다."));
    }

    private User requireUser(String email) {
        return userService.findByEmail(email.trim().toLowerCase())
                .orElseThrow(() -> new BusinessException(HttpStatus.UNAUTHORIZED, "로그인이 필요합니다."));
    }
}
