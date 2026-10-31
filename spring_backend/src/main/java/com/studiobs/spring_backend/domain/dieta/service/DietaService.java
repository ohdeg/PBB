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
    private final org.springframework.transaction.PlatformTransactionManager transactionManager;
    private final jakarta.persistence.EntityManager entityManager;

    // All queue writers/lease transitions and intake writes share this DB lock.
    // READ_COMMITTED prevents an earlier user lookup from pinning a stale MySQL snapshot.
    private <T> T locked(UUID userId, java.util.function.Supplier<T> work) {
        var tx = new org.springframework.transaction.support.TransactionTemplate(transactionManager);
        tx.setIsolationLevel(org.springframework.transaction.TransactionDefinition.ISOLATION_READ_COMMITTED);
        return tx.execute(status -> {
            entityManager.clear(); // discard entities retained by OpenEntityManagerInView across short transactions
            profileRepository.findLockedByUserId(userId)
                    .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "Dieta 프로필이 없습니다."));
            return work.get();
        });
    }

    private DietaIntakeLog completedIntake(UUID userId, LocalDate day) {
        return intakeLogRepository.findByUserIdAndLoggedOn(userId, day)
                .filter(row -> DietaIntakeSourceDocument.parse(objectMapper, row.getSourceMealsJson()).queueTotals() != null)
                .orElse(null);
    }

    /** Caller holds the profile write lock, including when recovering an expired lease. */
    private DietaMealQueueDayResponse currentQueue(UUID userId, LocalDate day) {
        var queue = mealQueueRedisService.getOrEmpty(userId, day);
        if (completedIntake(userId, day) != null) {
            return mealQueueRedisService.withStatus(queue, "done");
        }
        if ("pending".equals(queue.status()) && (queue.updatedAt() == null
                || queue.updatedAt().plusSeconds(120).isBefore(java.time.Instant.now()))) {
            return mealQueueRedisService.save(userId, mealQueueRedisService.withStatus(queue, "failed"));
        }
        return queue;
    }

    private static void requireEditable(DietaMealQueueDayResponse queue) {
        if ("done".equals(queue.status()) || "pending".equals(queue.status())) {
            throw new BusinessException(HttpStatus.CONFLICT, "분석 중이거나 마감된 기록은 수정할 수 없어요. 새로고침해 주세요.");
        }
    }

    private void requireLease(UUID userId, DietaMealQueueDayResponse claimed) {
        var current = mealQueueRedisService.getOrEmpty(userId, claimed.loggedOn());
        if (!"pending".equals(current.status()) || !java.util.Objects.equals(current.updatedAt(), claimed.updatedAt())
                || claimed.updatedAt().plusSeconds(120).isBefore(java.time.Instant.now())) {
            throw new BusinessException(HttpStatus.CONFLICT, "분석 작업이 만료되었어요. 다시 시도해 주세요.");
        }
    }


    private static final Set<String> MEAL_TYPES = Set.of("BREAKFAST", "LUNCH", "DINNER", "SNACK");

    @Transactional(readOnly = true)
    public DietaProfileResponse getProfile(String email) {
        User user = requireUser(email);
        DietaProfile profile = profileRepository.findById(user.getId())
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "Dieta 프로필이 없습니다."));
        return toProfileResponse(profile);
    }

    @Transactional(isolation = org.springframework.transaction.annotation.Isolation.READ_COMMITTED)
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

    /**
     * Wipes all Dieta data for the user (MySQL rows + Redis meal queues) so onboarding can run again.
     * Idempotent when no profile exists.
     */
    @Transactional(isolation = org.springframework.transaction.annotation.Isolation.READ_COMMITTED)
    public void resetAll(String email) {
        User user = requireUser(email);
        UUID userId = user.getId();
        profileRepository.findLockedByUserId(userId);
        bodyLogRepository.deleteByUserId(userId);
        intakeLogRepository.deleteByUserId(userId);
        activityLogRepository.deleteByUserId(userId);
        ketoEventRepository.deleteByUserId(userId);
        checkInLogRepository.deleteByUserId(userId);
        recipeRepository.deleteByUserId(userId);
        profileRepository.deleteById(userId);
        mealQueueRedisService.deleteAllForUser(userId);
    }

    @Transactional(isolation = org.springframework.transaction.annotation.Isolation.READ_COMMITTED)
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

    @Transactional(isolation = org.springframework.transaction.annotation.Isolation.READ_COMMITTED)
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

    @Transactional(isolation = org.springframework.transaction.annotation.Isolation.READ_COMMITTED)
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

    @Transactional(isolation = org.springframework.transaction.annotation.Isolation.READ_COMMITTED)
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

    @Transactional(isolation = org.springframework.transaction.annotation.Isolation.READ_COMMITTED)
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

    public DietaMealQueueDayResponse getMealQueue(String email, LocalDate loggedOn) {
        User user = requireUser(email);
        return locked(user.getId(), () -> currentQueue(user.getId(), loggedOn));
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

    @Transactional(isolation = org.springframework.transaction.annotation.Isolation.READ_COMMITTED)
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

        DietaMealQueueDayResponse queue = currentQueue(user.getId(), request.loggedOn());
        requireEditable(queue);
        DietaMealQueueDayResponse next = mealQueueRedisService.addItem(queue, mealType, text);
        return mealQueueRedisService.save(user.getId(), next);
    }

    @Transactional(isolation = org.springframework.transaction.annotation.Isolation.READ_COMMITTED)
    public DietaMealQueueDayResponse removeMealQueueItem(String email, LocalDate loggedOn, String itemId) {
        User user = requireUser(email);
        requireProfile(user.getId());
        DietaMealQueueDayResponse queue = currentQueue(user.getId(), loggedOn);
        requireEditable(queue);
        DietaMealQueueDayResponse next = mealQueueRedisService.removeItem(queue, itemId);
        return mealQueueRedisService.save(user.getId(), next);
    }

    @Transactional(readOnly = true)
    public List<DietaRecipeResponse> listRecipes(String email, LocalDate loggedOn) {
        User user = requireUser(email);
        requireProfile(user.getId());
        List<DietaRecipe> recipes =
                loggedOn != null
                        ? dayRecipes(user.getId(), loggedOn)
                        : recipeRepository.findTop100ByUserIdAndRecordKindInOrderByCreatedAtDescIdDesc(user.getId(), List.of("LEGACY", "LIBRARY"));
        return recipes.stream().map(this::toRecipeResponse).toList();
    }

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

        String ingredientsJson;
        try {
            ingredientsJson = objectMapper.writeValueAsString(ingredients);
        } catch (JacksonException ex) {
            throw new BusinessException(HttpStatus.INTERNAL_SERVER_ERROR, "재료 목록을 저장할 수 없습니다.");
        }

        return locked(user.getId(), () -> {
            if (!requireProfile(user.getId()).isGeminiMealConsent()) {
                throw new BusinessException(HttpStatus.FORBIDDEN, "식단 AI 분석 동의가 해제되었어요.");
            }
            DietaRecipe savedRecipe = recipeRepository.save(DietaRecipe.builder()
                    .userId(user.getId())
                    .loggedOn(request.loggedOn())
                    .mealType(null)
                    .recordKind("LIBRARY")
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

            return new DietaRecipeAnalyzeResponse(
                    savedRecipe.getId().toString(),
                    carbG,
                    proteinG,
                    fatG,
                    kcal,
                    geminiResponse.oneLineReview(),
                    savedRecipe.getServings(),
                    null);
        });
    }

    /**
     * Copy an existing recipe's macros into a new day-scoped row and merge into intake.
     * No Gemini call — does not require {@code geminiMealConsent}.
     */
    @Transactional(isolation = org.springframework.transaction.annotation.Isolation.READ_COMMITTED)
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
                .recordKind("INTAKE")
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

        List<DietaRecipe> dayRecipes = dayRecipes(user.getId(), request.loggedOn());
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

    public DietaMealFinalizeResponse finalizeMealDay(String email, LocalDate loggedOn) {
        User user = requireUser(email);
        // Timestamp is the lease token. Claim/reclaim/commit all hold the same DB row lock.
        DietaMealQueueDayResponse pending = locked(user.getId(), () -> {
            DietaProfile profile = requireProfile(user.getId());
            if (!profile.isGeminiMealConsent()) {
                throw new BusinessException(HttpStatus.FORBIDDEN, "식단 AI 분석 동의가 필요해요. 설정에서 켜 주세요.");
            }
            var queue = currentQueue(user.getId(), loggedOn);
            if ("done".equals(queue.status())) return queue;
            requireEditable(queue);
            if (queue.items() == null || queue.items().isEmpty()) {
                throw new BusinessException(HttpStatus.BAD_REQUEST, "오늘 큐가 비어 있어요.");
            }
            return mealQueueRedisService.save(user.getId(), mealQueueRedisService.withStatus(queue, "pending"));
        });
        if ("done".equals(pending.status())) {
            return new DietaMealFinalizeResponse(DietaIntakeLogResponse.from(completedIntake(user.getId(), loggedOn)), pending);
        }
        DietaIntakeLogResponse saved;
        try {
            DietaGeminiMealRequest geminiRequest = locked(user.getId(), () -> {
                requireLease(user.getId(), pending);
                var activity = activityLogRepository.findByUserIdAndLoggedOn(user.getId(), loggedOn).orElse(null);
                return DietaGeminiRequestBuilder.build(loggedOn, pending.items(), requireProfile(user.getId()), activity,
                        DietaGeminiRequestBuilder.toKnownRecipes(dayRecipes(user.getId(), loggedOn)));
            });
            // No Spring transaction is active across the external call.
            DietaGeminiMealResponse geminiResponse = geminiMealClient.analyze(geminiRequest);
            saved = locked(user.getId(), () -> {
                requireLease(user.getId(), pending);
                if (!requireProfile(user.getId()).isGeminiMealConsent()) {
                    throw new BusinessException(HttpStatus.FORBIDDEN, "식단 AI 분석 동의가 해제되었어요.");
                }
                var dayRecipes = dayRecipes(user.getId(), loggedOn);
                var knownRecipes = DietaGeminiRequestBuilder.toKnownRecipes(dayRecipes);
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


                return DietaIntakeLogResponse.from(intake);
            });
        } catch (RuntimeException ex) {
            // Never overwrite a replacement worker's state. Recovery remains possible if Redis is unavailable.
            try {
                locked(user.getId(), () -> {
                    var current = mealQueueRedisService.getOrEmpty(user.getId(), loggedOn);
                    if ("pending".equals(current.status()) && java.util.Objects.equals(current.updatedAt(), pending.updatedAt())
                            && completedIntake(user.getId(), loggedOn) == null) {
                        mealQueueRedisService.save(user.getId(), mealQueueRedisService.withStatus(current, "failed"));
                    }
                    return null;
                });
            } catch (RuntimeException recoveryFailure) { ex.addSuppressed(recoveryFailure); }
            throw ex;
        }
        // DB commit already succeeded. A Redis error must not turn a successful analysis into a failure.
        var done = mealQueueRedisService.withStatus(pending, "done");
        try {
            locked(user.getId(), () -> {
                var current = mealQueueRedisService.getOrEmpty(user.getId(), loggedOn);
                if (java.util.Objects.equals(current.updatedAt(), pending.updatedAt())) {
                    mealQueueRedisService.save(user.getId(), done);
                }
                return null;
            });
        } catch (RuntimeException ignored) { /* durable queueTotals allows recovery on the next request */ }
        return new DietaMealFinalizeResponse(saved, done);
    }

    public DietaMealFinalizeResponse autoFinalizeYesterday(String email) {
        User user = requireUser(email);
        LocalDate yesterday = LocalDate.now().minusDays(1);
        boolean eligible = locked(user.getId(), () -> {
            var queue = currentQueue(user.getId(), yesterday);
            return requireProfile(user.getId()).isGeminiMealConsent()
                    && !queue.items().isEmpty() && !"done".equals(queue.status()) && !"pending".equals(queue.status());
        });
        return eligible ? finalizeMealDay(email, yesterday) : null;
    }

    private List<DietaRecipe> dayRecipes(UUID userId, LocalDate day) {
        return recipeRepository.findByUserIdAndLoggedOnOrderByCreatedAtAsc(userId, day).stream()
                .filter(recipe -> !"LIBRARY".equals(recipe.getRecordKind())).toList();
    }

    @Transactional(isolation = org.springframework.transaction.annotation.Isolation.READ_COMMITTED)
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

    @Transactional(isolation = org.springframework.transaction.annotation.Isolation.READ_COMMITTED)
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

        if (request.revisionToken() == null || !request.revisionToken().equals(ctx.revisionToken())) {
            throw new BusinessException(HttpStatus.CONFLICT, "DIETA_PROPOSAL_CHANGED", "기록이 바뀌었거나 제안이 만료되었어요. 새 계획을 확인해 주세요.");
        }
        if (!ctx.due() && !ctx.targetReached()) {
            throw new BusinessException(HttpStatus.CONFLICT, "아직 주간 체크인 날짜가 아니에요.");
        }
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

        List<DietaIntakeLog> intakes = intakeLogRepository
                .findByUserIdAndLoggedOnGreaterThanEqualAndLoggedOnLessThanOrderByLoggedOnAsc(
                        userId, profile.getWeekStartsOn(), loggedOn);
        int days = intakes.size();
        int avg = days == 0 ? 0 : (int) Math.round(intakes.stream().mapToLong(DietaIntakeLog::getKcal).sum() / (double) days);
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
        if (reached) {
            proposal = new DietaMath.WeekProposal("MAINTAIN", null, null, avg, days,
                    weightDelta, null, null, proposal.proposedTdee(), proposal.proposedTdee(), 0,
                    "HOLD", "목표 체중에 도달했어요. 유지 모드로 전환하고 일일 목표를 TDEE에 맞춰요.");
        }

        return new CheckInContext(
                weightKg,
                baselineWeight,
                weightDelta,
                proposal,
                profile.getWeekStartsOn(),
                due,
                reached,
                proposalRevision(userId, loggedOn, weightKg, choice, profile, baseline, intakes));
    }

    private String proposalRevision(UUID userId, LocalDate day, BigDecimal weight, String choice,
            DietaProfile profile, DietaBodyLog baseline, List<DietaIntakeLog> intakes) {
        try {
            // An opaque freshness fingerprint, not an authorization token. User auth is still mandatory.
            byte[] state = objectMapper.writeValueAsBytes(new Object[] {
                    userId, day, weight.stripTrailingZeros().toPlainString(), choice, toProfileResponse(profile),
                    baseline == null ? null : DietaBodyLogResponse.from(baseline),
                    intakes.stream().map(DietaIntakeLogResponse::from).toList()
            });
            return java.util.HexFormat.of().formatHex(java.security.MessageDigest.getInstance("SHA-256").digest(state));
        } catch (java.security.NoSuchAlgorithmException ex) { throw new IllegalStateException(ex); }
    }

    private DietaWeekProposalResponse toProposalResponse(CheckInContext ctx) {
        return DietaWeekProposalResponse.from(
                ctx.proposal(),
                ctx.baselineWeightKg(),
                ctx.checkInWeightKg(),
                ctx.weekStartsOn(),
                ctx.due(),
                ctx.targetReached(),
                ctx.revisionToken());
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
            boolean targetReached,
            String revisionToken
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
        boolean writing = org.springframework.transaction.support.TransactionSynchronizationManager.isActualTransactionActive()
                && !org.springframework.transaction.support.TransactionSynchronizationManager.isCurrentTransactionReadOnly();
        return (writing ? profileRepository.findLockedByUserId(userId) : profileRepository.findById(userId))
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "Dieta 프로필이 없습니다."));
    }

    private User requireUser(String email) {
        return userService.findByEmail(email.trim().toLowerCase())
                .orElseThrow(() -> new BusinessException(HttpStatus.UNAUTHORIZED, "로그인이 필요합니다."));
    }
}
