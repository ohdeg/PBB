package com.studiobs.spring_backend.domain.brew.controller;

import com.studiobs.spring_backend.domain.auth.support.AccessTokenResolver;
import com.studiobs.spring_backend.domain.brew.dto.CalendarResponse;
import com.studiobs.spring_backend.domain.brew.dto.CoverAfterLeaveCountResponse;
import com.studiobs.spring_backend.domain.brew.dto.CoverResponse;
import com.studiobs.spring_backend.domain.brew.dto.ApproveJoinRequest;
import com.studiobs.spring_backend.domain.brew.dto.AssignCoverRequest;
import com.studiobs.spring_backend.domain.brew.dto.CreateCoverRequest;
import com.studiobs.spring_backend.domain.brew.dto.CreateStoreRequest;
import com.studiobs.spring_backend.domain.brew.dto.JoinRequestResponse;
import com.studiobs.spring_backend.domain.brew.dto.LeaveDateRequest;
import com.studiobs.spring_backend.domain.brew.dto.MenuResponse;
import com.studiobs.spring_backend.domain.brew.dto.NameRequest;
import com.studiobs.spring_backend.domain.brew.dto.NoticeRequest;
import com.studiobs.spring_backend.domain.brew.dto.NoticeResponse;
import com.studiobs.spring_backend.domain.brew.dto.RecipeContentsRequest;
import com.studiobs.spring_backend.domain.brew.dto.RecipeResponse;
import com.studiobs.spring_backend.domain.brew.dto.ReplaceSchedulesRequest;
import com.studiobs.spring_backend.domain.brew.dto.ScheduleResponse;
import com.studiobs.spring_backend.domain.brew.dto.StaffMemberResponse;
import com.studiobs.spring_backend.domain.brew.dto.StockCategoryResponse;
import com.studiobs.spring_backend.domain.brew.dto.StockPermissionRequest;
import com.studiobs.spring_backend.domain.brew.dto.StockRequest;
import com.studiobs.spring_backend.domain.brew.dto.StockResponse;
import com.studiobs.spring_backend.domain.brew.dto.StoreResponse;
import com.studiobs.spring_backend.domain.brew.dto.SubscriberResponse;
import com.studiobs.spring_backend.domain.brew.dto.TimerPresetRequest;
import com.studiobs.spring_backend.domain.brew.dto.TimerPresetResponse;
import com.studiobs.spring_backend.domain.brew.dto.UpdateStoreRequest;
import com.studiobs.spring_backend.domain.brew.service.BrewScheduleService;
import com.studiobs.spring_backend.domain.brew.service.BrewService;
import com.studiobs.spring_backend.domain.brew.service.BrewTimerPresetService;
import com.studiobs.spring_backend.global.common.MessageResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
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
@RequestMapping("/api/v1/brew")
@RequiredArgsConstructor
public class BrewController {

    private final BrewService brewService;
    private final BrewScheduleService brewScheduleService;
    private final BrewTimerPresetService brewTimerPresetService;
    private final AccessTokenResolver accessTokenResolver;

    @GetMapping("/stores/mine")
    public List<StoreResponse> myStores(HttpServletRequest request) {
        return brewService.listMyStores(accessTokenResolver.requireEmail(request));
    }

    @GetMapping("/stores/public")
    public List<StoreResponse> publicStores(HttpServletRequest request) {
        return brewService.listPublicStores(accessTokenResolver.findEmail(request).orElse(null));
    }

    @GetMapping("/stores/search")
    public List<StoreResponse> searchStores(
            HttpServletRequest request,
            @RequestParam(name = "q", defaultValue = "") String q
    ) {
        return brewService.searchStores(accessTokenResolver.findEmail(request).orElse(null), q);
    }

    @GetMapping("/subscriptions")
    public List<StoreResponse> subscriptions(HttpServletRequest request) {
        return brewService.listSubscriptions(accessTokenResolver.requireEmail(request));
    }

    @PostMapping("/stores")
    @ResponseStatus(HttpStatus.CREATED)
    public StoreResponse createStore(
            HttpServletRequest request,
            @Valid @RequestBody CreateStoreRequest body
    ) {
        return brewService.createStore(accessTokenResolver.requireEmail(request), body);
    }

    @PostMapping("/stores/{storeId}/invite-code/regenerate")
    public StoreResponse regenerateInviteCode(
            HttpServletRequest request,
            @PathVariable UUID storeId
    ) {
        return brewService.regenerateInviteCode(
                accessTokenResolver.requireEmail(request),
                storeId
        );
    }

    @GetMapping("/stores/{storeId}")
    public StoreResponse getStore(HttpServletRequest request, @PathVariable UUID storeId) {
        return brewService.getStore(storeId, accessTokenResolver.findEmail(request).orElse(null));
    }

    @PatchMapping("/stores/{storeId}")
    public StoreResponse updateStore(
            HttpServletRequest request,
            @PathVariable UUID storeId,
            @Valid @RequestBody UpdateStoreRequest body
    ) {
        return brewService.updateStore(accessTokenResolver.requireEmail(request), storeId, body);
    }

    @DeleteMapping("/stores/{storeId}")
    public MessageResponse deleteStore(HttpServletRequest request, @PathVariable UUID storeId) {
        brewService.deleteStore(accessTokenResolver.requireEmail(request), storeId);
        return new MessageResponse("가게가 삭제되었습니다.");
    }

    @GetMapping("/stores/{storeId}/menus")
    public List<MenuResponse> listMenus(HttpServletRequest request, @PathVariable UUID storeId) {
        return brewService.listMenus(storeId, accessTokenResolver.findEmail(request).orElse(null));
    }

    @PostMapping("/stores/{storeId}/menus")
    @ResponseStatus(HttpStatus.CREATED)
    public MenuResponse createMenu(
            HttpServletRequest request,
            @PathVariable UUID storeId,
            @Valid @RequestBody NameRequest body
    ) {
        return brewService.createMenu(accessTokenResolver.requireEmail(request), storeId, body);
    }

    @PatchMapping("/menus/{menuId}")
    public MenuResponse updateMenu(
            HttpServletRequest request,
            @PathVariable UUID menuId,
            @Valid @RequestBody NameRequest body
    ) {
        return brewService.updateMenu(accessTokenResolver.requireEmail(request), menuId, body);
    }

    @DeleteMapping("/menus/{menuId}")
    public MessageResponse deleteMenu(HttpServletRequest request, @PathVariable UUID menuId) {
        brewService.deleteMenu(accessTokenResolver.requireEmail(request), menuId);
        return new MessageResponse("메뉴가 삭제되었습니다.");
    }

    @GetMapping("/stores/{storeId}/notices")
    public List<NoticeResponse> listNotices(HttpServletRequest request, @PathVariable UUID storeId) {
        return brewService.listNotices(accessTokenResolver.requireEmail(request), storeId);
    }

    @PostMapping("/stores/{storeId}/notices")
    @ResponseStatus(HttpStatus.CREATED)
    public NoticeResponse createNotice(
            HttpServletRequest request,
            @PathVariable UUID storeId,
            @Valid @RequestBody NoticeRequest body
    ) {
        return brewService.createNotice(accessTokenResolver.requireEmail(request), storeId, body);
    }

    @PatchMapping("/notices/{noticeId}")
    public NoticeResponse updateNotice(
            HttpServletRequest request,
            @PathVariable UUID noticeId,
            @Valid @RequestBody NoticeRequest body
    ) {
        return brewService.updateNotice(accessTokenResolver.requireEmail(request), noticeId, body);
    }

    @DeleteMapping("/notices/{noticeId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteNotice(HttpServletRequest request, @PathVariable UUID noticeId) {
        brewService.deleteNotice(accessTokenResolver.requireEmail(request), noticeId);
    }

    @GetMapping("/menus/{menuId}/recipes")
    public List<RecipeResponse> listRecipes(HttpServletRequest request, @PathVariable UUID menuId) {
        return brewService.listRecipes(menuId, accessTokenResolver.findEmail(request).orElse(null));
    }

    @PostMapping("/menus/{menuId}/recipes")
    @ResponseStatus(HttpStatus.CREATED)
    public RecipeResponse createRecipe(
            HttpServletRequest request,
            @PathVariable UUID menuId,
            @Valid @RequestBody RecipeContentsRequest body
    ) {
        return brewService.createRecipe(accessTokenResolver.requireEmail(request), menuId, body);
    }

    @PatchMapping("/recipes/{recipeId}")
    public RecipeResponse updateRecipe(
            HttpServletRequest request,
            @PathVariable UUID recipeId,
            @Valid @RequestBody RecipeContentsRequest body
    ) {
        return brewService.updateRecipe(accessTokenResolver.requireEmail(request), recipeId, body);
    }

    @DeleteMapping("/recipes/{recipeId}")
    public MessageResponse deleteRecipe(HttpServletRequest request, @PathVariable UUID recipeId) {
        brewService.deleteRecipe(accessTokenResolver.requireEmail(request), recipeId);
        return new MessageResponse("레시피가 삭제되었습니다.");
    }

    @GetMapping("/stores/{storeId}/stocks")
    public List<StockCategoryResponse> listStocks(HttpServletRequest request, @PathVariable UUID storeId) {
        return brewService.listStockCategories(storeId, accessTokenResolver.requireEmail(request));
    }

    @PostMapping("/stores/{storeId}/stock-categories")
    @ResponseStatus(HttpStatus.CREATED)
    public StockCategoryResponse createStockCategory(
            HttpServletRequest request,
            @PathVariable UUID storeId,
            @Valid @RequestBody NameRequest body
    ) {
        return brewService.createStockCategory(accessTokenResolver.requireEmail(request), storeId, body);
    }

    @PatchMapping("/stock-categories/{categoryId}")
    public StockCategoryResponse renameStockCategory(
            HttpServletRequest request,
            @PathVariable Integer categoryId,
            @Valid @RequestBody NameRequest body
    ) {
        return brewService.renameStockCategory(
                accessTokenResolver.requireEmail(request),
                categoryId,
                body
        );
    }

    @DeleteMapping("/stock-categories/{categoryId}")
    public MessageResponse deleteStockCategory(
            HttpServletRequest request,
            @PathVariable Integer categoryId
    ) {
        brewService.deleteStockCategory(accessTokenResolver.requireEmail(request), categoryId);
        return new MessageResponse("재고 카테고리가 삭제되었습니다.");
    }

    @PostMapping("/stock-categories/{categoryId}/stocks")
    @ResponseStatus(HttpStatus.CREATED)
    public StockResponse createStock(
            HttpServletRequest request,
            @PathVariable Integer categoryId,
            @Valid @RequestBody StockRequest body
    ) {
        return brewService.createStock(accessTokenResolver.requireEmail(request), categoryId, body);
    }

    @PatchMapping("/stocks/{stockId}")
    public StockResponse updateStock(
            HttpServletRequest request,
            @PathVariable Integer stockId,
            @Valid @RequestBody StockRequest body
    ) {
        return brewService.updateStock(accessTokenResolver.requireEmail(request), stockId, body);
    }

    @DeleteMapping("/stocks/{stockId}")
    public MessageResponse deleteStock(HttpServletRequest request, @PathVariable Integer stockId) {
        brewService.deleteStock(accessTokenResolver.requireEmail(request), stockId);
        return new MessageResponse("재고가 삭제되었습니다.");
    }

    @GetMapping("/stores/{storeId}/subscribers")
    public List<SubscriberResponse> listSubscribers(
            HttpServletRequest request,
            @PathVariable UUID storeId
    ) {
        return brewService.listSubscribers(accessTokenResolver.requireEmail(request), storeId);
    }

    @PatchMapping("/stores/{storeId}/subscribers/{userId}/stock-permission")
    public SubscriberResponse updateStockPermission(
            HttpServletRequest request,
            @PathVariable UUID storeId,
            @PathVariable UUID userId,
            @Valid @RequestBody StockPermissionRequest body
    ) {
        return brewService.updateSubscriberStockPermission(
                accessTokenResolver.requireEmail(request),
                storeId,
                userId,
                body
        );
    }

    @PostMapping("/stores/{storeId}/join")
    public MessageResponse requestJoin(HttpServletRequest request, @PathVariable UUID storeId) {
        brewService.requestJoin(accessTokenResolver.requireEmail(request), storeId);
        return new MessageResponse("가입 신청이 접수되었습니다. 업주 승인을 기다려 주세요.");
    }

    @GetMapping("/stores/{storeId}/join-requests")
    public List<JoinRequestResponse> listJoinRequests(
            HttpServletRequest request,
            @PathVariable UUID storeId
    ) {
        return brewService.listJoinRequests(accessTokenResolver.requireEmail(request), storeId);
    }

    @PostMapping("/stores/{storeId}/join-requests/{userId}/approve")
    public MessageResponse approveJoin(
            HttpServletRequest request,
            @PathVariable UUID storeId,
            @PathVariable UUID userId,
            @Valid @RequestBody ApproveJoinRequest body
    ) {
        brewService.approveJoin(accessTokenResolver.requireEmail(request), storeId, userId, body);
        return new MessageResponse("가입을 승인했습니다.");
    }

    @PostMapping("/stores/{storeId}/join-requests/{userId}/reject")
    public MessageResponse rejectJoin(
            HttpServletRequest request,
            @PathVariable UUID storeId,
            @PathVariable UUID userId
    ) {
        brewService.rejectJoin(accessTokenResolver.requireEmail(request), storeId, userId);
        return new MessageResponse("가입 신청을 거절했습니다.");
    }

    @DeleteMapping("/subscriptions/{storeId}")
    public MessageResponse unsubscribe(
            HttpServletRequest request,
            @PathVariable UUID storeId,
            @Valid @RequestBody LeaveDateRequest body
    ) {
        brewService.unsubscribe(accessTokenResolver.requireEmail(request), storeId, body);
        return new MessageResponse("퇴사가 예약·처리되었습니다.");
    }

    @PostMapping("/stores/{storeId}/subscribers/{userId}/resign")
    public Object resignSubscriber(
            HttpServletRequest request,
            @PathVariable UUID storeId,
            @PathVariable UUID userId,
            @Valid @RequestBody LeaveDateRequest body
    ) {
        SubscriberResponse result = brewService.resignSubscriber(
                accessTokenResolver.requireEmail(request),
                storeId,
                userId,
                body
        );
        if (result == null) {
            return new MessageResponse("퇴사 처리되었습니다.");
        }
        return result;
    }

    @DeleteMapping("/stores/{storeId}/subscribers/{userId}/leave")
    public SubscriberResponse clearScheduledLeave(
            HttpServletRequest request,
            @PathVariable UUID storeId,
            @PathVariable UUID userId
    ) {
        return brewService.clearScheduledLeave(
                accessTokenResolver.requireEmail(request),
                storeId,
                userId
        );
    }

    @DeleteMapping("/subscriptions/{storeId}/leave")
    public MessageResponse clearMyScheduledLeave(
            HttpServletRequest request,
            @PathVariable UUID storeId
    ) {
        String email = accessTokenResolver.requireEmail(request);
        // resolve user id via resign clear — need userId; use service method for self
        brewService.clearMyScheduledLeave(email, storeId);
        return new MessageResponse("퇴사 예약을 취소했습니다.");
    }

    @GetMapping("/stores/{storeId}/schedules")
    public List<ScheduleResponse> listSchedules(HttpServletRequest request, @PathVariable UUID storeId) {
        return brewScheduleService.listSchedules(accessTokenResolver.requireEmail(request), storeId);
    }

    @GetMapping("/stores/{storeId}/staff")
    public List<StaffMemberResponse> listStaff(HttpServletRequest request, @PathVariable UUID storeId) {
        return brewScheduleService.listStaff(accessTokenResolver.requireEmail(request), storeId);
    }

    @PutMapping("/stores/{storeId}/schedules/{userId}")
    public List<ScheduleResponse> replaceSchedules(
            HttpServletRequest request,
            @PathVariable UUID storeId,
            @PathVariable UUID userId,
            @Valid @RequestBody ReplaceSchedulesRequest body
    ) {
        return brewScheduleService.replaceSchedules(
                accessTokenResolver.requireEmail(request),
                storeId,
                userId,
                body
        );
    }

    @GetMapping("/stores/{storeId}/calendar")
    public CalendarResponse getCalendar(
            HttpServletRequest request,
            @PathVariable UUID storeId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to
    ) {
        return brewScheduleService.getCalendar(
                accessTokenResolver.requireEmail(request),
                storeId,
                from,
                to
        );
    }

    @GetMapping("/stores/{storeId}/subscribers/{userId}/covers-after-leave")
    public CoverAfterLeaveCountResponse countCoversAfterLeave(
            HttpServletRequest request,
            @PathVariable UUID storeId,
            @PathVariable UUID userId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate leaveDate
    ) {
        int count = brewScheduleService.countCoversAfterLeaveDate(
                accessTokenResolver.requireEmail(request),
                storeId,
                userId,
                leaveDate
        );
        return new CoverAfterLeaveCountResponse(count);
    }

    @GetMapping("/stores/{storeId}/covers/pending")
    public List<CoverResponse> listPendingCovers(
            HttpServletRequest request,
            @PathVariable UUID storeId
    ) {
        return brewScheduleService.listPendingCovers(
                accessTokenResolver.requireEmail(request),
                storeId
        );
    }

    @PostMapping("/stores/{storeId}/covers")
    @ResponseStatus(HttpStatus.CREATED)
    public CoverResponse createCover(
            HttpServletRequest request,
            @PathVariable UUID storeId,
            @Valid @RequestBody CreateCoverRequest body
    ) {
        return brewScheduleService.createCover(
                accessTokenResolver.requireEmail(request),
                storeId,
                body
        );
    }

    @PostMapping("/covers/{coverId}/assign")
    public CoverResponse assignCover(
            HttpServletRequest request,
            @PathVariable UUID coverId,
            @Valid @RequestBody AssignCoverRequest body
    ) {
        return brewScheduleService.assignCover(
                accessTokenResolver.requireEmail(request),
                coverId,
                body
        );
    }

    @PostMapping("/covers/{coverId}/accept")
    public CoverResponse acceptCover(HttpServletRequest request, @PathVariable UUID coverId) {
        return brewScheduleService.acceptCover(accessTokenResolver.requireEmail(request), coverId);
    }

    @PostMapping("/covers/{coverId}/reject")
    public CoverResponse rejectCover(HttpServletRequest request, @PathVariable UUID coverId) {
        return brewScheduleService.rejectCover(accessTokenResolver.requireEmail(request), coverId);
    }

    @PostMapping("/covers/{coverId}/cancel")
    public CoverResponse cancelCover(HttpServletRequest request, @PathVariable UUID coverId) {
        return brewScheduleService.cancelCover(accessTokenResolver.requireEmail(request), coverId);
    }

    @GetMapping("/timer-presets")
    public List<TimerPresetResponse> listPersonalTimerPresets(HttpServletRequest request) {
        return brewTimerPresetService.listPersonal(accessTokenResolver.requireEmail(request));
    }

    @PostMapping("/timer-presets")
    @ResponseStatus(HttpStatus.CREATED)
    public TimerPresetResponse createPersonalTimerPreset(
            HttpServletRequest request,
            @Valid @RequestBody TimerPresetRequest body
    ) {
        return brewTimerPresetService.createPersonal(accessTokenResolver.requireEmail(request), body);
    }

    @PutMapping("/timer-presets/{presetId}")
    public TimerPresetResponse updatePersonalTimerPreset(
            HttpServletRequest request,
            @PathVariable UUID presetId,
            @Valid @RequestBody TimerPresetRequest body
    ) {
        return brewTimerPresetService.updatePersonal(
                accessTokenResolver.requireEmail(request),
                presetId,
                body
        );
    }

    @DeleteMapping("/timer-presets/{presetId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deletePersonalTimerPreset(HttpServletRequest request, @PathVariable UUID presetId) {
        brewTimerPresetService.deletePersonal(accessTokenResolver.requireEmail(request), presetId);
    }

    @GetMapping("/stores/{storeId}/timer-presets")
    public List<TimerPresetResponse> listStoreTimerPresets(
            HttpServletRequest request,
            @PathVariable UUID storeId
    ) {
        return brewTimerPresetService.listStore(accessTokenResolver.requireEmail(request), storeId);
    }

    @PostMapping("/stores/{storeId}/timer-presets")
    @ResponseStatus(HttpStatus.CREATED)
    public TimerPresetResponse createStoreTimerPreset(
            HttpServletRequest request,
            @PathVariable UUID storeId,
            @Valid @RequestBody TimerPresetRequest body
    ) {
        return brewTimerPresetService.createStore(
                accessTokenResolver.requireEmail(request),
                storeId,
                body
        );
    }

    @PutMapping("/stores/{storeId}/timer-presets/{presetId}")
    public TimerPresetResponse updateStoreTimerPreset(
            HttpServletRequest request,
            @PathVariable UUID storeId,
            @PathVariable UUID presetId,
            @Valid @RequestBody TimerPresetRequest body
    ) {
        return brewTimerPresetService.updateStore(
                accessTokenResolver.requireEmail(request),
                storeId,
                presetId,
                body
        );
    }

    @DeleteMapping("/stores/{storeId}/timer-presets/{presetId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteStoreTimerPreset(
            HttpServletRequest request,
            @PathVariable UUID storeId,
            @PathVariable UUID presetId
    ) {
        brewTimerPresetService.deleteStore(
                accessTokenResolver.requireEmail(request),
                storeId,
                presetId
        );
    }
}
