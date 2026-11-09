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
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import com.studiobs.spring_backend.domain.dieta.service.DietaAnalysisStore.Stage;
import com.studiobs.spring_backend.domain.dieta.service.DietaAnalysisStore.Origin;
import com.studiobs.spring_backend.domain.dieta.dto.meal.DietaMealQueueItemDto;
import com.studiobs.spring_backend.domain.dieta.dto.meal.DietaMealSchedule;
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

    private final DietaEntryStore entries;
    private final Clock clock;
    private final DietaAnalysisStore analyses;
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

    DietaIntakeLog completedIntake(UUID userId, LocalDate day) {
        return intakeLogRepository.findByUserIdAndLoggedOn(userId, day)
                .filter(row -> DietaIntakeSourceDocument.parse(objectMapper, row.getSourceMealsJson()).queueTotals() != null)
                .orElse(null);
    }

    /** Caller holds the profile write lock, including when recovering an expired lease. */
    DietaMealQueueDayResponse currentQueue(UUID userId, LocalDate day) {
        var queue = mealQueueRedisService.getOrEmpty(userId, day);
        var intake = completedIntake(userId, day);
        Stage stage = intake == null ? Stage.MAIN : Stage.SUPPLEMENT;
        var attempt = analyses.attempt(userId, day, stage);
        var items = entries.items(userId, day, queue.items());
        int added = items.size();
        boolean reconstructable = true;
        if (intake != null) {
            var snapshot = DietaIntakeSourceDocument.parse(objectMapper, intake.getSourceMealsJson());
            var combined = new java.util.ArrayList<DietaMealQueueItemDto>();
            var reflected = entries.read(userId,day,"REFLECTED",DietaMealQueueItemDto[].class);
            if (reflected != null) combined.addAll(List.of(reflected));
            else for (var meal : snapshot.meals()) {
                for (String text : meal.items()) {
                    combined.add(new DietaMealQueueItemDto("base:legacy-" + combined.size(), meal.mealType(), text, null));
                }
            }
            reconstructable = !combined.isEmpty();
            var extras = items.stream().filter(i -> i.id().startsWith("extra:")).toList();
            added = extras.size();
            if (attempt != null && "DONE".equals(attempt.state())) added = 0;
            else combined.addAll(extras);
            combined.addAll(items.stream().filter(i -> i.id().startsWith("note:")).toList());
            items = combined;
        }
        boolean pending = "pending".equals(queue.status()) && queue.updatedAt() != null
                && queue.updatedAt().plusSeconds(120).isAfter(clock.instant())
                && (intake == null || attempt != null);
        String status;
        String available = null;
        if (attempt != null && "DONE".equals(attempt.state())) status = "done";
        else if (pending && (attempt == null || !"FAILED".equals(attempt.state()))) status = "pending";
        else if (attempt != null && attempt.spent()) status = "exhausted";
        else {
            status = intake != null ? "done" : ("failed".equals(queue.status()) || "pending".equals(queue.status()) ? "failed" : "open");
            if (reconstructable) available = stage.name();
        }
        return new DietaMealQueueDayResponse(day, status, items, queue.updatedAt(), available, added);
    }

    private static void requireEditable(DietaMealQueueDayResponse queue) {
        if (queue.availableStage() == null) {
            throw new BusinessException(HttpStatus.CONFLICT, "분석 중이거나 기회를 모두 사용했어요.");
        }
    }

    private void requireLease(UUID userId, DietaMealQueueDayResponse claimed) {
        var current = mealQueueRedisService.getOrEmpty(userId, claimed.loggedOn());
        if (!"pending".equals(current.status()) || !java.util.Objects.equals(current.updatedAt(), claimed.updatedAt())
                || !claimed.updatedAt().plusSeconds(120).isAfter(clock.instant())) {
            throw new BusinessException(HttpStatus.CONFLICT, "분석 작업이 만료되었어요. 식사 화면에서 분석 상태를 확인해 주세요.");
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
        if (!profile.isGeminiMealConsent() && request.mealSchedule() != null && request.mealSchedule().enabled()) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "예약 분석에는 AI 분석 동의가 필요해요.");
        }
        if (!profile.isGeminiMealConsent()) analyses.configure(user.getId(), DietaMealSchedule.disabled(), clock.instant());
        else if (request.mealSchedule() != null) analyses.configure(user.getId(), request.mealSchedule(), clock.instant());
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

    List<DietaActivityLogResponse> activitiesInRange(UUID user, LocalDate start, LocalDate end) {
        var records=entries.activityMetadata(user,start,end);
        return activityLogRepository.findByUserIdAndLoggedOnBetweenOrderByLoggedOnAsc(user,start,end).stream()
                .map(log->activityResponse(log,records.get(log.getLoggedOn()))).toList();
    }

    DietaActivityHistory.Suggestions activitySuggestions(UUID user,LocalDate day) {
        var rows=activitiesInRange(user,day.minusDays(28),day.minusDays(1));
        var revision=entries.hash(List.of(day,rows.stream().map(DietaActivityLogResponse::revision).toList()));
        return DietaActivityHistory.suggestions(rows,day,revision);
    }

    void checkEntryDay(UUID user, LocalDate day, String deviceZone) {
        var schedule=analyses.schedule(user);
        java.time.ZoneId zone;
        try { zone=java.time.ZoneId.of(schedule.enabled()?schedule.zone():deviceZone==null?"UTC":deviceZone); }
        catch(java.time.DateTimeException e) { throw DietaEntryStore.invalid("시간대를 확인해 주세요."); }
        var today=LocalDate.now(clock.withZone(zone));
        if (day.isBefore(today.minusDays(1)) || day.isAfter(today)) throw DietaEntryStore.invalid("오늘 또는 어제 날짜를 선택해 주세요.");
    }

    private record ActivityMeta(String name, java.util.Set<String> fields) {}
    DietaActivityLogResponse activityResponse(UUID user, DietaActivityLog log) {
        return activityResponse(log,entries.raw(user,log.getLoggedOn(),"ACTIVITY"));
    }
    private DietaActivityLogResponse activityResponse(DietaActivityLog log,String json) {
        var meta=json==null?null:objectMapper.readValue(json,ActivityMeta.class);
        if (meta == null) meta = new ActivityMeta(null,java.util.Set.of());
        var plain = DietaActivityLogResponse.from(log);
        return new DietaActivityLogResponse(plain.id(),plain.loggedOn(),plain.steps(),plain.durationMin(),plain.activityKcal(),
                plain.splitCalories(),plain.walkingKcal(),plain.exerciseKcal(),plain.note(),meta.name(),meta.fields(),
                entries.hash(new Object[]{plain,meta.name(),meta.fields().stream().sorted().toList()}));
    }

    @Transactional(readOnly = true)
    public List<DietaActivityLogResponse> listActivities(String email) {
        User user = requireUser(email);
        return activitiesInRange(user.getId(),LocalDate.of(1000,1,1),LocalDate.of(9999,12,31));
    }

    @Transactional(isolation = org.springframework.transaction.annotation.Isolation.READ_COMMITTED)
    public DietaActivityLogResponse upsertActivity(String email, DietaActivityUpsertRequest request) {
        User user = requireUser(email);
        var profile = requireProfile(user.getId());
        var log = activityLogRepository.findByUserIdAndLoggedOn(user.getId(), request.loggedOn())
                .orElseGet(() -> DietaActivityLog.builder().userId(user.getId()).loggedOn(request.loggedOn()).build());
        var previous = activityResponse(user.getId(),log);
        String fingerprint=entries.hash(request);
        if (log.getId()!=null && fingerprint.equals(entries.read(user.getId(),request.loggedOn(),"ACTLAST",String.class)))
            return previous;
        if (request.revision() != null && !request.revision().equals(previous.revision())
                && !(request.revision().equals("empty") && log.getId() == null)) throw DietaEntryStore.stale();
        var fields = request.estimatedFields() == null ? new java.util.HashSet<>(previous.estimatedFields())
                : new java.util.HashSet<>(request.estimatedFields());
        if (!java.util.Set.of("steps","durationMin","exerciseKcal").containsAll(fields)) throw DietaEntryStore.invalid("알 수 없는 활동 지표예요.");
        if (request.estimatedFields()==null) {
            if (!java.util.Objects.equals(request.steps(),previous.steps())) fields.remove("steps");
            if (!java.util.Objects.equals(request.durationMin(),previous.durationMin())) fields.remove("durationMin");
            if (!java.util.Objects.equals(request.exerciseKcal(),previous.exerciseKcal())) fields.remove("exerciseKcal");
        }
        if (request.steps() == null) fields.remove("steps");
        if (request.durationMin() == null) fields.remove("durationMin");
        if (request.exerciseKcal() == null) fields.remove("exerciseKcal");
        if (request.revision()!=null) checkEntryDay(user.getId(),request.loggedOn(),request.deviceZone());
        if (request.suggestionRevision()!=null || !previous.estimatedFields().containsAll(fields)) {
            var suggestions=activitySuggestions(user.getId(),request.loggedOn());
            if (!suggestions.revision().equals(request.suggestionRevision())) throw DietaEntryStore.stale();
            var allowed = suggestions.averages();
            if (fields.stream().anyMatch(f -> !previous.estimatedFields().contains(f) && !allowed.containsKey(f)))
                throw DietaEntryStore.stale();
        }
        String name = request.estimatedFields() == null ? previous.activityName() : request.activityName();
        if (name != null && name.isBlank()) name = null;
        if (request.estimatedFields()!=null && Integer.valueOf(0).equals(request.durationMin())
                && (name!=null || request.exerciseKcal()!=null && request.exerciseKcal()>0))
            throw DietaEntryStore.invalid("운동 안 함을 기록하려면 운동명과 운동 열량을 비워 주세요.");
        if (name == null && request.steps()==null && request.durationMin()==null && request.exerciseKcal()==null
                && request.activityKcal()==null && (request.note()==null || request.note().isBlank()))
            throw DietaEntryStore.invalid("활동 기록을 하나 이상 입력해 주세요.");
        boolean split = Boolean.TRUE.equals(request.splitCalories());
        if (split && request.activityKcal() != null
                || !split && request.exerciseKcal() != null) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "활동 열량의 입력 방식을 확인해 주세요.");
        }
        if (request.expectedLegacyKcal() != null && (!split || log.isSplitCalories()
                        || !request.expectedLegacyKcal().equals(log.getActivityKcal()))
                || log.isSplitCalories() && !split
                || split && !log.isSplitCalories() && log.getActivityKcal() != null
                        && request.expectedLegacyKcal() == null) {
            throw new BusinessException(HttpStatus.CONFLICT, "활동 열량 저장 방식을 확인해 주세요.");
        }
        Integer walking = log.getWalkingKcal();
        if (split && (walking == null || !java.util.Objects.equals(log.getSteps(), request.steps()))) {
            var weight = request.steps() == null || request.steps() == 0 ? null : bodyLogRepository
                    .findFirstByUserIdAndLoggedOnLessThanEqualAndWeightKgGreaterThanOrderByLoggedOnDesc(
                            user.getId(), request.loggedOn(), BigDecimal.ZERO)
                    .map(DietaBodyLog::getWeightKg).orElse(null);
            try {
                walking = DietaMath.walkingKcal(request.steps(), profile.getHeightCm(), weight);
            } catch (ArithmeticException ex) {
                throw new BusinessException(HttpStatus.BAD_REQUEST, "걸음 수가 너무 큽니다.");
            }
        }
        log.update(request.steps(), request.durationMin(), request.activityKcal(), request.note());
        if (split) {
            try {
                log.setCalorieBreakdown(walking, request.exerciseKcal());
            } catch (ArithmeticException ex) {
                throw new BusinessException(HttpStatus.BAD_REQUEST, "활동 열량이 너무 큽니다.");
            }
        }
        if (request.revision()!=null) checkEntryDay(user.getId(),request.loggedOn(),request.deviceZone());
        entries.write(user.getId(),request.loggedOn(),"ACTLAST",fingerprint);
        entries.write(user.getId(),request.loggedOn(),"ACTIVITY",new ActivityMeta(name,fields));
        return activityResponse(user.getId(),activityLogRepository.save(log));
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
        return locked(user.getId(), () -> {
            UUID id = user.getId();
            var queue = currentQueue(id, loggedOn);
            var schedule = analyses.schedule(id);
            ZoneId zone = schedule.enabled() ? ZoneId.of(schedule.zone()) : ZoneId.systemDefault();
            LocalDate yesterday = LocalDate.now(clock.withZone(zone)).minusDays(1);
            var attempt = analyses.attempt(id, yesterday, Stage.MAIN);
            if (attempt != null && !attempt.spent() && !"SKIPPED".equals(attempt.state())
                    && requireProfile(id).isGeminiMealConsent()) {
                var previous = currentQueue(id, yesterday);
                if ("MAIN".equals(previous.availableStage()) && previous.newItemCount() > 0) {
                    return queue.withRetryableYesterday(yesterday);
                }
            }
            return queue;
        });
    }

    @Transactional(readOnly = true)
    public List<DietaIntakeLogResponse> listIntakes(String email, LocalDate loggedOn) {
        User user = requireUser(email);
        requireProfile(user.getId());
        var rows = loggedOn == null ? intakeLogRepository.findByUserIdOrderByLoggedOnAsc(user.getId())
                : intakeLogRepository.findByUserIdAndLoggedOn(user.getId(), loggedOn).stream().toList();
        return reportedIntakes(user.getId(), rows, loggedOn == null ? LocalDate.of(1000,1,1) : loggedOn,
                loggedOn == null ? LocalDate.of(9999,12,31) : loggedOn);
    }

    private List<DietaIntakeLogResponse> reportedIntakes(UUID user, List<DietaIntakeLog> rows, LocalDate start, LocalDate end) {
        var result = new java.util.TreeMap<LocalDate,DietaIntakeLogResponse>();
        rows.forEach(r -> result.put(r.getLoggedOn(), DietaIntakeLogResponse.from(r)));
        for (var estimate : entries.estimates(user,start,end)) {
            var day = estimate.day();
            var old = result.get(day);
            var total = old == null ? estimate.value() : estimate.value().plus(
                    new MacroTotals(old.carbG(),old.proteinG(),old.fatG(),old.kcal()));
            var id = old == null ? UUID.nameUUIDFromBytes((user.toString()+day).getBytes(java.nio.charset.StandardCharsets.UTF_8)) : old.id();
            var estimates = new java.util.TreeMap<String,Integer>();
            if (old!=null) estimates.putAll(old.estimatedMealKcal());
            estimates.put(estimate.meal(),estimate.value().kcal());
            result.put(day,new DietaIntakeLogResponse(id,day,total.carbG(),total.proteinG(),total.fatG(),total.kcal(),
                    old == null ? null : old.review(),old == null ? null : old.sourceMealsJson(),true,estimates));
        }
        return List.copyOf(result.values());
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
        if ("pending".equals(queue.status())) throw DietaEntryStore.stale();
        if (text.length() > 1000) throw DietaEntryStore.invalid("음식 기록은 1000자까지 입력할 수 있어요.");
        var added = mealQueueRedisService.addItem(queue, mealType, text);
        var items = new java.util.ArrayList<>(added.items());
        if (queue.availableStage() == null) {
            var item = items.removeLast();
            items.add(new DietaMealQueueItemDto("note:" + item.id(), mealType, text, item.addedAt()));
        }
        entries.write(user.getId(), request.loggedOn(), "ITEMS", items);
        entries.clearEstimate(user.getId(), request.loggedOn(), mealType);
        return currentQueue(user.getId(), request.loggedOn());
    }

    @Transactional(isolation = org.springframework.transaction.annotation.Isolation.READ_COMMITTED)
    public DietaMealQueueDayResponse removeMealQueueItem(String email, LocalDate loggedOn, String itemId) {
        User user = requireUser(email);
        requireProfile(user.getId());
        DietaMealQueueDayResponse queue = currentQueue(user.getId(), loggedOn);
        if (!itemId.startsWith("note:") || "pending".equals(queue.status())) requireEditable(queue);
        if ("SUPPLEMENT".equals(queue.availableStage()) && !itemId.startsWith("extra:")) {
            throw new BusinessException(HttpStatus.CONFLICT, "이미 분석한 음식은 삭제할 수 없어요.");
        }
        entries.write(user.getId(), loggedOn, "ITEMS", mealQueueRedisService.removeItem(queue, itemId).items());
        return currentQueue(user.getId(), loggedOn);
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

        return copyRecipe(user.getId(), source, request.loggedOn(), mealType, BigDecimal.ONE);
    }

    DietaRecipeAnalyzeResponse copyRecipe(UUID userId, DietaRecipe source, LocalDate date, String mealType, BigDecimal portion) {
        return copyRecipe(userId,source,date,mealType,portion,null);
    }

    DietaRecipeAnalyzeResponse copyRecipe(UUID userId, DietaRecipe source, LocalDate date, String mealType, BigDecimal portion,
            DietaIntakeSourceDocument.AnalyzedRecipe legacy) {
        if ("pending".equals(currentQueue(userId,date).status())) throw DietaEntryStore.stale();
        entries.clearEstimate(userId, date, mealType);
        var nutrition = DietaEntryStore.scale(recipeNutrition(source), portion);
        // Copy 1인분 (per-serving) macros into the day row.
        DietaRecipe savedRecipe = recipeRepository.save(DietaRecipe.builder()
                .userId(userId)
                .loggedOn(date)
                .mealType(mealType)
                .recordKind("INTAKE")
                .title(source.getTitle())
                .ingredientsJson(source.getIngredientsJson())
                .steps(source.getSteps())
                .carbG(nutrition.carbG())
                .proteinG(nutrition.proteinG())
                .fatG(nutrition.fatG())
                .kcal(nutrition.kcal())
                .oneLineReview(source.getOneLineReview())
                .servings(source.getServings() == null ? BigDecimal.ONE : source.getServings())
                .build());

        entries.write(userId, date, "PORT:" + savedRecipe.getId(), new RecipePortion(source.getId(), portion, legacy));
        List<DietaRecipe> dayRecipes = dayRecipes(userId, date);
        MacroTotals recipeSum = sumRecipeMacros(dayRecipes);

        String review = source.getOneLineReview() != null
                ? source.getOneLineReview()
                : "등록 레시피를 오늘 섭취에 더했어요.";

        DietaIntakeLog intake = upsertIntakeWithRecipe(
                userId,
                date,
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

    record RecipePortion(UUID source, BigDecimal portion, DietaIntakeSourceDocument.AnalyzedRecipe legacy) {}
    static MacroTotals recipeNutrition(DietaRecipe r) {
        return new MacroTotals(r.getCarbG(), r.getProteinG(), r.getFatG(), r.getKcal());
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
        return finalizeMealDay(email, loggedOn, Stage.MAIN);
    }

    public DietaMealFinalizeResponse finalizeMealDay(String email, LocalDate day, Stage stage) {
        return finalizeDay(requireUser(email).getId(), day, stage == null ? Stage.MAIN : stage, Origin.MANUAL, null);
    }

    private record Claim(DietaMealQueueDayResponse queue, DietaIntakeLogResponse existing) {}

    private DietaMealFinalizeResponse finalizeDay(UUID userId, LocalDate loggedOn, Stage stage, Origin origin,
            DietaAnalysisStore.Due due) {
        UUID claim = UUID.randomUUID();
        Claim work = locked(userId, () -> {
            var profile = requireProfile(userId);
            if (origin != Origin.MANUAL) {
                if (!profile.isGeminiMealConsent() || !automaticEligible(userId, loggedOn, origin, due)) return null;
            } else if (!profile.isGeminiMealConsent()) {
                throw new BusinessException(HttpStatus.FORBIDDEN, "식단 AI 분석 동의가 필요해요.");
            }
            var queue = currentQueue(userId, loggedOn);
            var completed = completedIntake(userId, loggedOn);
            var attempt = analyses.attempt(userId, loggedOn, stage);
            if (completed != null && (stage == Stage.MAIN || attempt != null && "DONE".equals(attempt.state()))) {
                return origin == Origin.MANUAL ? new Claim(queue, DietaIntakeLogResponse.from(completed)) : null;
            }
            if (!stage.name().equals(queue.availableStage()) || queue.newItemCount() == 0) {
                if (origin != Origin.MANUAL) {
                    if (origin == Origin.SCHEDULED && "MAIN".equals(queue.availableStage()) && queue.items().isEmpty()) {
                        analyses.reserve(userId, loggedOn, stage, origin, claim);
                        analyses.transition(userId, loggedOn, stage, claim, "READY", "SKIPPED");
                    }
                    return null;
                }
                throw new BusinessException(HttpStatus.CONFLICT, "새 기록과 남은 분석 기회를 확인해 주세요.");
            }
            analyses.reserve(userId, loggedOn, stage, origin, claim);
            return new Claim(mealQueueRedisService.save(userId, mealQueueRedisService.withStatus(queue, "pending")), null);
        });
        if (work == null) return null;
        if (work.existing() != null) return new DietaMealFinalizeResponse(work.existing(), work.queue());
        var pending = work.queue();
        DietaIntakeLogResponse saved;
        try {
            DietaGeminiMealRequest geminiRequest = locked(userId, () -> {
                requireLease(userId, pending);
                var activity = activityLogRepository.findByUserIdAndLoggedOn(userId, loggedOn).orElse(null);
                var mealRequest = DietaGeminiRequestBuilder.build(loggedOn, pending.items(), requireProfile(userId), activity,
                        DietaGeminiRequestBuilder.toKnownRecipes(dayRecipes(userId, loggedOn)));
                if (activity == null) return mealRequest;
                var details = activityResponse(userId,activity);
                var hint = new DietaGeminiMealRequest.ActivityHint(details.steps(),details.durationMin(),details.activityKcal(),
                        details.activityName(),details.estimatedFields());
                return new DietaGeminiMealRequest(mealRequest.schemaVersion(),mealRequest.locale(),loggedOn,
                        mealRequest.goalHint(),mealRequest.meals(),mealRequest.knownRecipes(),hint,mealRequest.instructions());
            });
            // No Spring transaction is active across the external call.
            var send = geminiMealClient.prepare(geminiRequest);
            locked(userId, () -> {
                requireLease(userId, pending);
                if (!requireProfile(userId).isGeminiMealConsent()
                        || origin != Origin.MANUAL && !automaticEligible(userId, loggedOn, origin, due)
                        || !analyses.transition(userId, loggedOn, stage, claim, "READY", "SENT")) {
                    throw new BusinessException(HttpStatus.CONFLICT, "분석 설정 또는 처리 상태가 변경되었어요.");
                }
                return null;
            });
            DietaGeminiMealResponse geminiResponse;
            try {
                geminiResponse = send.get();
            } catch (BusinessException ex) {
                throw new BusinessException(ex.getStatus(), "분석에 실패해 이 분석 기회를 사용했어요. 입력한 기록은 보관돼요.");
            }
            saved = locked(userId, () -> {
                requireLease(userId, pending);
                if (!requireProfile(userId).isGeminiMealConsent()) {
                    throw new BusinessException(HttpStatus.FORBIDDEN, "식단 AI 분석 동의가 해제되었어요.");
                }
                var dayRecipes = dayRecipes(userId, loggedOn);
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
                entries.write(userId,loggedOn,"REFLECTED",reflectedItems(pending));
                entries.write(userId, loggedOn, "ANALYSIS", DietaMealBreakdown.validated(
                        geminiRequest.meals(), geminiResponse.mealTotals(), queueTotals));
                MacroTotals recipeSum = sumRecipeMacros(dayRecipes);

                DietaIntakeLog existing = intakeLogRepository
                        .findByUserIdAndLoggedOn(userId, loggedOn)
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
                            .userId(userId)
                            .loggedOn(loggedOn)
                            .carbG(combined.carbG())
                            .proteinG(combined.proteinG())
                            .fatG(combined.fatG())
                            .kcal(combined.kcal())
                            .review(dayReview)
                            .sourceMealsJson(sourceJson)
                            .build());
                }


                if (!analyses.transition(userId, loggedOn, stage, claim, "SENT", "DONE")) {
                    throw new BusinessException(HttpStatus.CONFLICT, "분석 처리권이 만료되었어요.");
                }
                return DietaIntakeLogResponse.from(intake);
            });
        } catch (RuntimeException ex) {
            // Never overwrite a replacement worker's state. Recovery remains possible if Redis is unavailable.
            try {
                locked(userId, () -> {
                    if (!analyses.transition(userId, loggedOn, stage, claim, "SENT", "FAILED")) {
                        analyses.transition(userId, loggedOn, stage, claim, "READY", "RETRYABLE");
                    }
                    var current = mealQueueRedisService.getOrEmpty(userId, loggedOn);
                    if ("pending".equals(current.status()) && java.util.Objects.equals(current.updatedAt(), pending.updatedAt())) {
                        mealQueueRedisService.save(userId, mealQueueRedisService.withStatus(current, "failed"));
                    }
                    return null;
                });
            } catch (RuntimeException recoveryFailure) { ex.addSuppressed(recoveryFailure); }
            throw ex;
        }
        // DB commit already succeeded. A Redis error must not turn a successful analysis into a failure.
        var done = mealQueueRedisService.withStatus(pending, "done");
        try {
            locked(userId, () -> {
                var current = mealQueueRedisService.getOrEmpty(userId, loggedOn);
                if (java.util.Objects.equals(current.updatedAt(), pending.updatedAt())) {
                    mealQueueRedisService.save(userId, done);
                }
                return null;
            });
        } catch (RuntimeException ignored) { /* durable queueTotals allows recovery on the next request */ }
        var reflected = reflectedItems(pending);
        var result = new DietaMealQueueDayResponse(loggedOn, "done", reflected, done.updatedAt(),
                stage == Stage.MAIN ? "SUPPLEMENT" : null, 0);
        return new DietaMealFinalizeResponse(saved, result);
    }

    private static List<DietaMealQueueItemDto> reflectedItems(DietaMealQueueDayResponse pending) {
        return pending.items().stream().map(i -> new DietaMealQueueItemDto(i.id().startsWith("base:") ? i.id() : "base:"+i.id(),
                i.mealType(),i.text(),i.addedAt())).toList();
    }

    private boolean automaticEligible(UUID userId, LocalDate day, Origin origin, DietaAnalysisStore.Due due) {
        var schedule = analyses.schedule(userId);
        if (origin == Origin.LEGACY_AUTO && schedule.enabled()) return false;
        if (origin == Origin.SCHEDULED && (!schedule.enabled() || !due.at().equals(schedule.nextRunAt()))) return false;
        var attempt = analyses.attempt(userId, day, Stage.MAIN);
        return attempt == null || "READY".equals(attempt.state()) && !Origin.MANUAL.name().equals(attempt.origin());
    }

    public DietaMealFinalizeResponse autoFinalizeYesterday(String email) {
        UUID userId = requireUser(email).getId();
        return finalizeDay(userId, LocalDate.now(clock.withZone(ZoneId.systemDefault())).minusDays(1),
                Stage.MAIN, Origin.LEGACY_AUTO, null);
    }

    void runDue(DietaAnalysisStore.Due due) {
        UUID id = due.userId();
        var schedule = analyses.schedule(id);
        if (!due.at().equals(schedule.nextRunAt())) return;
        LocalDate day = due.at().atZone(ZoneId.of(schedule.zone())).toLocalDate();
        // Leave the due cursor in place until dispatch finishes. A restart can recover a pre-send claim.
        if (!due.at().isBefore(clock.instant().minus(java.time.Duration.ofHours(48)))) {
            try {
                finalizeDay(id, day, Stage.MAIN, Origin.SCHEDULED, due);
            } finally {
                advanceDueUnlessPreparing(due, day);
            }
        } else {
            locked(id, () -> { analyses.advance(due, schedule, clock.instant()); return null; });
        }
    }

    private void advanceDueUnlessPreparing(DietaAnalysisStore.Due due, LocalDate day) {
        locked(due.userId(), () -> {
            var schedule = analyses.schedule(due.userId());
            if (!due.at().equals(schedule.nextRunAt())) return null;
            var queue = currentQueue(due.userId(), day);
            if (!"pending".equals(queue.status())) analyses.advance(due, schedule, clock.instant());
            return null;
        });
    }

    List<DietaRecipe> dayRecipes(UUID userId, LocalDate day) {
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
        var reported = reportedIntakes(userId,intakes,profile.getWeekStartsOn(),loggedOn.minusDays(1));
        int days = reported.size();
        int avg = days == 0 ? 0 : (int) Math.round(reported.stream().mapToLong(DietaIntakeLogResponse::kcal).sum() / (double) days);
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
                proposalRevision(userId, loggedOn, weightKg, choice, profile, baseline, reported));
    }

    private String proposalRevision(UUID userId, LocalDate day, BigDecimal weight, String choice,
            DietaProfile profile, DietaBodyLog baseline, List<DietaIntakeLogResponse> intakes) {
        try {
            // An opaque freshness fingerprint, not an authorization token. User auth is still mandatory.
            byte[] state = objectMapper.writeValueAsBytes(new Object[] {
                    userId, day, weight.stripTrailingZeros().toPlainString(), choice, DietaProfileResponse.from(profile, parseMacros(profile.getMacrosJson()), null),
                    baseline == null ? null : DietaBodyLogResponse.from(baseline),
                    intakes
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
        var portion="INTAKE".equals(recipe.getRecordKind()) ?
                entries.read(recipe.getUserId(),recipe.getLoggedOn(),"PORT:"+recipe.getId(),RecipePortion.class) : null;
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
                recipe.getCreatedAt(), portion==null?BigDecimal.ONE:portion.portion());
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
        return DietaProfileResponse.from(profile, parseMacros(profile.getMacrosJson()), analyses.schedule(profile.getUserId()));
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

    DietaProfile requireProfile(UUID userId) {
        boolean writing = org.springframework.transaction.support.TransactionSynchronizationManager.isActualTransactionActive()
                && !org.springframework.transaction.support.TransactionSynchronizationManager.isCurrentTransactionReadOnly();
        return (writing ? profileRepository.findLockedByUserId(userId) : profileRepository.findById(userId))
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "Dieta 프로필이 없습니다."));
    }

    User requireUser(String email) {
        return userService.findByEmail(email.trim().toLowerCase())
                .orElseThrow(() -> new BusinessException(HttpStatus.UNAUTHORIZED, "로그인이 필요합니다."));
    }
}
