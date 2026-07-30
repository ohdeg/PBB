package com.studiobs.spring_backend.domain.dieta.controller;

import com.studiobs.spring_backend.domain.auth.support.AccessTokenResolver;
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
import com.studiobs.spring_backend.domain.dieta.dto.DietaMaintainModeRequest;
import com.studiobs.spring_backend.domain.dieta.dto.DietaOnboardingRequest;
import com.studiobs.spring_backend.domain.dieta.dto.DietaProfilePatchRequest;
import com.studiobs.spring_backend.domain.dieta.dto.DietaProfileResponse;
import com.studiobs.spring_backend.domain.dieta.dto.DietaWeekProposalResponse;
import com.studiobs.spring_backend.domain.dieta.dto.meal.DietaMealFinalizeRequest;
import com.studiobs.spring_backend.domain.dieta.dto.meal.DietaMealFinalizeResponse;
import com.studiobs.spring_backend.domain.dieta.dto.meal.DietaMealQueueAddItemRequest;
import com.studiobs.spring_backend.domain.dieta.dto.meal.DietaMealQueueDayResponse;
import com.studiobs.spring_backend.domain.dieta.dto.meal.DietaRecipeAddToDayRequest;
import com.studiobs.spring_backend.domain.dieta.dto.meal.DietaRecipeAnalyzeRequest;
import com.studiobs.spring_backend.domain.dieta.dto.meal.DietaRecipeAnalyzeResponse;
import com.studiobs.spring_backend.domain.dieta.dto.meal.DietaRecipeResponse;
import com.studiobs.spring_backend.domain.dieta.service.DietaService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/dieta")
@RequiredArgsConstructor
public class DietaController {

    private final DietaService dietaService;
    private final AccessTokenResolver accessTokenResolver;

    @GetMapping("/profile")
    public DietaProfileResponse getProfile(HttpServletRequest request) {
        return dietaService.getProfile(accessTokenResolver.requireEmail(request));
    }

    @PostMapping("/onboarding")
    @ResponseStatus(HttpStatus.CREATED)
    public DietaProfileResponse onboarding(
            HttpServletRequest request,
            @Valid @RequestBody DietaOnboardingRequest body
    ) {
        return dietaService.completeOnboarding(accessTokenResolver.requireEmail(request), body);
    }

    /** Deletes all Dieta data for the caller so they can complete onboarding again. */
    @PostMapping("/reset")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void reset(HttpServletRequest request) {
        dietaService.resetAll(accessTokenResolver.requireEmail(request));
    }

    @PatchMapping("/profile")
    public DietaProfileResponse patchProfile(
            HttpServletRequest request,
            @Valid @RequestBody DietaProfilePatchRequest body
    ) {
        return dietaService.patchProfile(accessTokenResolver.requireEmail(request), body);
    }

    @PostMapping("/maintain-mode")
    public DietaProfileResponse maintainMode(
            HttpServletRequest request,
            @Valid @RequestBody DietaMaintainModeRequest body
    ) {
        return dietaService.setMaintainMode(accessTokenResolver.requireEmail(request), body);
    }

    @GetMapping("/body-logs")
    public List<DietaBodyLogResponse> listBodyLogs(HttpServletRequest request) {
        return dietaService.listBodyLogs(accessTokenResolver.requireEmail(request));
    }

    @PutMapping("/body-logs")
    public DietaBodyLogResponse upsertBodyLog(
            HttpServletRequest request,
            @Valid @RequestBody DietaBodyLogUpsertRequest body
    ) {
        return dietaService.upsertBodyLog(accessTokenResolver.requireEmail(request), body);
    }

    @GetMapping("/activities")
    public List<DietaActivityLogResponse> listActivities(HttpServletRequest request) {
        return dietaService.listActivities(accessTokenResolver.requireEmail(request));
    }

    @PutMapping("/activities")
    public DietaActivityLogResponse upsertActivity(
            HttpServletRequest request,
            @Valid @RequestBody DietaActivityUpsertRequest body
    ) {
        return dietaService.upsertActivity(accessTokenResolver.requireEmail(request), body);
    }

    @GetMapping("/keto-events")
    public List<DietaKetoEventResponse> listKetoEvents(HttpServletRequest request) {
        return dietaService.listKetoEvents(accessTokenResolver.requireEmail(request));
    }

    @PostMapping("/keto-events")
    @ResponseStatus(HttpStatus.CREATED)
    public DietaKetoEventResponse recordKeto(
            HttpServletRequest request,
            @Valid @RequestBody DietaKetoEventRequest body
    ) {
        return dietaService.recordKeto(accessTokenResolver.requireEmail(request), body);
    }

    @GetMapping("/check-ins")
    public List<DietaCheckInLogResponse> listCheckIns(HttpServletRequest request) {
        return dietaService.listCheckIns(accessTokenResolver.requireEmail(request));
    }

    @PostMapping("/check-ins/proposal")
    public DietaWeekProposalResponse proposeCheckIn(
            HttpServletRequest request,
            @Valid @RequestBody DietaCheckInProposalRequest body
    ) {
        return dietaService.proposeCheckIn(accessTokenResolver.requireEmail(request), body);
    }

    @PostMapping("/check-ins/apply")
    public DietaCheckInApplyResponse applyCheckIn(
            HttpServletRequest request,
            @Valid @RequestBody DietaCheckInApplyRequest body
    ) {
        return dietaService.applyCheckIn(accessTokenResolver.requireEmail(request), body);
    }

    @GetMapping("/meal-queue")
    public DietaMealQueueDayResponse getMealQueueByQuery(
            HttpServletRequest request,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate loggedOn
    ) {
        return dietaService.getMealQueue(accessTokenResolver.requireEmail(request), loggedOn);
    }

    @GetMapping("/meal-queue/{loggedOn}")
    public DietaMealQueueDayResponse getMealQueueByPath(
            HttpServletRequest request,
            @PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate loggedOn
    ) {
        return dietaService.getMealQueue(accessTokenResolver.requireEmail(request), loggedOn);
    }

    @PostMapping("/meal-queue/items")
    public DietaMealQueueDayResponse addMealQueueItem(
            HttpServletRequest request,
            @Valid @RequestBody DietaMealQueueAddItemRequest body
    ) {
        return dietaService.addMealQueueItem(accessTokenResolver.requireEmail(request), body);
    }

    @DeleteMapping("/meal-queue/items/{itemId}")
    public DietaMealQueueDayResponse removeMealQueueItem(
            HttpServletRequest request,
            @PathVariable String itemId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate loggedOn
    ) {
        return dietaService.removeMealQueueItem(
                accessTokenResolver.requireEmail(request), loggedOn, itemId);
    }

    @GetMapping("/recipes")
    public List<DietaRecipeResponse> listRecipes(
            HttpServletRequest request,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate loggedOn
    ) {
        return dietaService.listRecipes(accessTokenResolver.requireEmail(request), loggedOn);
    }

    @PostMapping("/recipes/analyze")
    public DietaRecipeAnalyzeResponse analyzeRecipe(
            HttpServletRequest request,
            @Valid @RequestBody DietaRecipeAnalyzeRequest body
    ) {
        return dietaService.analyzeRecipe(accessTokenResolver.requireEmail(request), body);
    }

    @PostMapping("/recipes/{recipeId}/add-to-day")
    public DietaRecipeAnalyzeResponse addRecipeToDay(
            HttpServletRequest request,
            @PathVariable UUID recipeId,
            @Valid @RequestBody DietaRecipeAddToDayRequest body
    ) {
        return dietaService.addRecipeToDay(
                accessTokenResolver.requireEmail(request), recipeId, body);
    }

    @PostMapping("/meal-queue/finalize")
    public DietaMealFinalizeResponse finalizeMealDay(
            HttpServletRequest request,
            @Valid @RequestBody DietaMealFinalizeRequest body
    ) {
        return dietaService.finalizeMealDay(
                accessTokenResolver.requireEmail(request), body.loggedOn());
    }

    @PostMapping("/meal-queue/auto-finalize-yesterday")
    public ResponseEntity<DietaMealFinalizeResponse> autoFinalizeYesterday(HttpServletRequest request) {
        DietaMealFinalizeResponse result =
                dietaService.autoFinalizeYesterday(accessTokenResolver.requireEmail(request));
        if (result == null) {
            return ResponseEntity.noContent().build();
        }
        return ResponseEntity.ok(result);
    }

    @GetMapping("/intakes")
    public List<DietaIntakeLogResponse> listIntakes(
            HttpServletRequest request,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate loggedOn
    ) {
        return dietaService.listIntakes(accessTokenResolver.requireEmail(request), loggedOn);
    }
}
