package com.studiobs.spring_backend.domain.brew.service;

import com.studiobs.spring_backend.domain.brew.dto.ApproveJoinRequest;
import com.studiobs.spring_backend.domain.brew.dto.BrewStatsResponse;
import com.studiobs.spring_backend.domain.brew.dto.CreateStoreRequest;
import com.studiobs.spring_backend.domain.brew.dto.JoinRequestResponse;
import com.studiobs.spring_backend.domain.brew.dto.LeaveDateRequest;
import com.studiobs.spring_backend.domain.brew.dto.MenuResponse;
import com.studiobs.spring_backend.domain.brew.dto.NameRequest;
import com.studiobs.spring_backend.domain.brew.dto.RecipeContentsRequest;
import com.studiobs.spring_backend.domain.brew.dto.RecipeResponse;
import com.studiobs.spring_backend.domain.brew.dto.ReplaceSchedulesRequest;
import com.studiobs.spring_backend.domain.brew.dto.ScheduleReplaceMode;
import com.studiobs.spring_backend.domain.brew.dto.ScheduleSlotRequest;
import com.studiobs.spring_backend.domain.brew.dto.StockPermissionRequest;
import com.studiobs.spring_backend.domain.brew.dto.StoreResponse;
import com.studiobs.spring_backend.domain.brew.dto.SubscriberResponse;
import com.studiobs.spring_backend.domain.brew.dto.UpdateStoreRequest;
import com.studiobs.spring_backend.domain.brew.entity.BrewMenu;
import com.studiobs.spring_backend.domain.brew.entity.BrewRecipe;
import com.studiobs.spring_backend.domain.brew.entity.BrewStore;
import com.studiobs.spring_backend.domain.brew.entity.BrewStoreSubscription;
import com.studiobs.spring_backend.domain.brew.repository.BrewMenuRepository;
import com.studiobs.spring_backend.domain.brew.repository.BrewRecipeRepository;
import com.studiobs.spring_backend.domain.brew.repository.BrewStoreRepository;
import com.studiobs.spring_backend.domain.brew.repository.BrewStoreSubscriptionRepository;
import com.studiobs.spring_backend.domain.brew.support.BrewInviteCodes;
import com.studiobs.spring_backend.domain.brew.support.BrewShiftTimes;
import com.studiobs.spring_backend.domain.brew.support.PosAccess;
import com.studiobs.spring_backend.domain.user.entity.User;
import com.studiobs.spring_backend.domain.user.service.UserService;
import com.studiobs.spring_backend.global.exception.BusinessException;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class BrewService {

    private final UserService userService;
    private final BrewStoreRepository storeRepository;
    private final BrewMenuRepository menuRepository;
    private final BrewRecipeRepository recipeRepository;
    private final BrewStoreSubscriptionRepository subscriptionRepository;
    private final BrewRedisService brewRedisService;
    private final BrewScheduleService brewScheduleService;

    @Transactional(readOnly = true)
    public BrewStatsResponse getStats() {
        BrewStatsResponse cached = brewRedisService.getCachedStats();
        if (cached != null) {
            return cached;
        }
        BrewStatsResponse fresh = new BrewStatsResponse(
                storeRepository.countDistinctOwners(),
                storeRepository.count());
        brewRedisService.saveStats(fresh);
        return fresh;
    }

    @Transactional(readOnly = true)
    public List<StoreResponse> listMyStores(String email) {
        PosAccess.forbidManagement();
        User user = requireUser(email);
        List<BrewStore> stores =
                storeRepository.findByOwnerUserIdOrderByUpdatedAtDesc(user.getId());
        return toStoreResponsesBatch(stores, user.getId());
    }

    @Transactional(readOnly = true)
    public List<StoreResponse> listPublicStores(String emailOrNull) {
        PosAccess.forbidManagement();
        UUID viewerId = resolveUserId(emailOrNull);
        List<BrewStore> stores = storeRepository.findByIsPublicTrueOrderByUpdatedAtDesc();
        return toStoreResponsesBatch(stores, viewerId);
    }

    @Transactional(readOnly = true)
    public List<StoreResponse> searchStores(String emailOrNull, String query) {
        PosAccess.forbidManagement();
        String q = query == null ? "" : query.trim();
        if (q.isEmpty()) {
            return List.of();
        }
        UUID viewerId = resolveUserId(emailOrNull);
        Map<UUID, BrewStore> unique = new LinkedHashMap<>();
        if (BrewInviteCodes.looksLikeCode(q)) {
            storeRepository.findByInviteCodeIgnoreCase(q).ifPresent(store ->
                    unique.put(store.getId(), store));
        }
        for (BrewStore store : storeRepository.findByNameContainingIgnoreCaseOrderByUpdatedAtDesc(q)) {
            unique.putIfAbsent(store.getId(), store);
        }
        return toStoreResponsesBatch(new ArrayList<>(unique.values()), viewerId);
    }

    @Transactional
    public List<StoreResponse> listSubscriptions(String email) {
        PosAccess.forbidManagement();
        User user = requireUser(email);
        LocalDate today = BrewShiftTimes.nowSeoul().toLocalDate();

        // Phase A: only rows whose leave_date is already past
        for (BrewStoreSubscription sub :
                subscriptionRepository.findBySubscriberUserIdAndLeaveDateBefore(user.getId(), today)) {
            LocalDate leaveDate = sub.getLeaveDate();
            if (leaveDate != null) {
                finalizeLeave(sub.getStoreId(), sub.getSubscriberUserId(), leaveDate);
            }
        }

        // Phase B: batch-load remaining subscriptions + stores + onDuty
        List<BrewStoreSubscription> active =
                subscriptionRepository.findBySubscriberUserIdOrderByCreatedAtDesc(user.getId());
        if (active.isEmpty()) {
            return List.of();
        }
        Map<UUID, BrewStoreSubscription> subsByStore = active.stream()
                .collect(Collectors.toMap(
                        BrewStoreSubscription::getStoreId,
                        Function.identity(),
                        (a, b) -> a,
                        LinkedHashMap::new));
        Map<UUID, BrewStore> storesById = storeRepository
                .findAllById(subsByStore.keySet())
                .stream()
                .collect(Collectors.toMap(BrewStore::getId, Function.identity(), (a, b) -> a));
        Map<UUID, Boolean> onDutyByStore = brewScheduleService.onDutyByStoreIds(
                user.getId(),
                subsByStore.keySet(),
                subsByStore);

        List<StoreResponse> result = new ArrayList<>(active.size());
        for (BrewStoreSubscription sub : active) {
            BrewStore store = storesById.get(sub.getStoreId());
            if (store == null) {
                continue;
            }
            result.add(StoreResponse.from(
                    store,
                    user.getId(),
                    true,
                    sub.isCanEditStock(),
                    Boolean.TRUE.equals(onDutyByStore.get(sub.getStoreId())),
                    sub.getLeaveDate()));
        }
        return result;
    }

    @Transactional
    public StoreResponse createStore(String email, CreateStoreRequest request) {
        PosAccess.forbidManagement();
        User user = requireUser(email);
        BrewStore store = storeRepository.save(BrewStore.builder()
                .ownerUserId(user.getId())
                .name(request.name().trim())
                .isPublic(request.isPublic())
                .inviteCode(allocateInviteCode())
                .build());
        return StoreResponse.from(
                store,
                user.getId(),
                false,
                false,
                brewScheduleService.isCurrentlyOnDuty(store.getId(), user.getId()),
                null);
    }

    @Transactional
    public StoreResponse regenerateInviteCode(String email, UUID storeId) {
        User user = requireUser(email);
        BrewStore store = requireOwnedStore(storeId, user.getId());
        store.rotateInviteCode(allocateInviteCode());
        return StoreResponse.from(
                storeRepository.save(store),
                user.getId(),
                false,
                false,
                brewScheduleService.isCurrentlyOnDuty(storeId, user.getId()),
                null);
    }

    private String allocateInviteCode() {
        for (int attempt = 0; attempt < 32; attempt += 1) {
            String code = BrewInviteCodes.generate();
            if (!storeRepository.existsByInviteCodeIgnoreCase(code)) {
                return code;
            }
        }
        throw new BusinessException(HttpStatus.INTERNAL_SERVER_ERROR, "INVITE_CODE_FAILED", "가게 코드 발급에 실패했습니다. 다시 시도해 주세요.");
    }

    @Transactional
    public StoreResponse getStore(UUID storeId, String emailOrNull) {
        processDueLeavesForStore(storeId);
        BrewStore store = requireStore(storeId);
        UUID viewerId = resolveUserId(emailOrNull);
        assertCanView(store, viewerId);
        return toStoreResponse(store, viewerId);
    }

    @Transactional
    public StoreResponse updateStore(String email, UUID storeId, UpdateStoreRequest request) {
        User user = requireUser(email);
        BrewStore store = requireOwnedStore(storeId, user.getId());
        store.update(
                request.name().trim(),
                request.isPublic(),
                request.stockEditOffDuty(),
                request.stockUsageHint());
        return StoreResponse.from(
                storeRepository.save(store),
                user.getId(),
                false,
                false,
                brewScheduleService.isCurrentlyOnDuty(storeId, user.getId()),
                null);
    }

    @Transactional
    public void deleteStore(String email, UUID storeId) {
        User user = requireUser(email);
        BrewStore store = requireOwnedStore(storeId, user.getId());
        storeRepository.delete(store);
    }

    @Transactional(readOnly = true)
    public List<MenuResponse> listMenus(UUID storeId, String emailOrNull) {
        BrewStore store = requireStore(storeId);
        assertCanView(store, resolveUserId(emailOrNull));
        return menuRepository.findByStoreIdOrderByCreatedAtAsc(storeId).stream()
                .map(MenuResponse::from)
                .toList();
    }

    @Transactional
    public MenuResponse createMenu(String email, UUID storeId, NameRequest request) {
        User user = requireUser(email);
        requireOwnedStore(storeId, user.getId());
        BrewMenu menu = menuRepository.save(BrewMenu.builder()
                .storeId(storeId)
                .name(request.name().trim())
                .build());
        return MenuResponse.from(menu);
    }

    @Transactional
    public MenuResponse updateMenu(String email, UUID menuId, NameRequest request) {
        User user = requireUser(email);
        BrewMenu menu = requireMenu(menuId);
        requireOwnedStore(menu.getStoreId(), user.getId());
        menu.rename(request.name().trim());
        return MenuResponse.from(menuRepository.save(menu));
    }

    @Transactional
    public void deleteMenu(String email, UUID menuId) {
        User user = requireUser(email);
        BrewMenu menu = requireMenu(menuId);
        requireOwnedStore(menu.getStoreId(), user.getId());
        menuRepository.delete(menu);
    }

    @Transactional(readOnly = true)
    public List<RecipeResponse> listRecipes(UUID menuId, String emailOrNull) {
        BrewMenu menu = requireMenu(menuId);
        BrewStore store = requireStore(menu.getStoreId());
        assertCanView(store, resolveUserId(emailOrNull));
        return recipeRepository.findByMenuIdOrderByCreatedAtAsc(menuId).stream()
                .map(RecipeResponse::from)
                .toList();
    }

    @Transactional
    public RecipeResponse createRecipe(String email, UUID menuId, RecipeContentsRequest request) {
        User user = requireUser(email);
        BrewMenu menu = requireMenu(menuId);
        requireOwnedStore(menu.getStoreId(), user.getId());
        BrewRecipe recipe = recipeRepository.save(BrewRecipe.builder()
                .menuId(menuId)
                .contents(request.contents())
                .build());
        return RecipeResponse.from(recipe);
    }

    @Transactional
    public RecipeResponse updateRecipe(String email, UUID recipeId, RecipeContentsRequest request) {
        User user = requireUser(email);
        BrewRecipe recipe = requireRecipe(recipeId);
        BrewMenu menu = requireMenu(recipe.getMenuId());
        requireOwnedStore(menu.getStoreId(), user.getId());
        recipe.updateContents(request.contents());
        return RecipeResponse.from(recipeRepository.save(recipe));
    }

    @Transactional
    public void deleteRecipe(String email, UUID recipeId) {
        User user = requireUser(email);
        BrewRecipe recipe = requireRecipe(recipeId);
        BrewMenu menu = requireMenu(recipe.getMenuId());
        requireOwnedStore(menu.getStoreId(), user.getId());
        recipeRepository.delete(recipe);
    }

    @Transactional
    public void requestJoin(String email, UUID storeId) {
        PosAccess.forbidManagement();
        User user = requireUser(email);
        BrewStore store = requireStore(storeId);
        if (store.getOwnerUserId().equals(user.getId())) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "JOIN_OWN_STORE", "본인 가게에는 가입 신청할 수 없습니다.");
        }
        if (subscriptionRepository.existsBySubscriberUserIdAndStoreId(user.getId(), storeId)) {
            throw new BusinessException(HttpStatus.CONFLICT, "ALREADY_SUBSCRIBED", "이미 구독 중인 가게입니다.");
        }
        brewRedisService.saveJoinRequest(storeId, user.getId());
    }

    @Transactional(readOnly = true)
    public List<JoinRequestResponse> listJoinRequests(String email, UUID storeId) {
        User owner = requireUser(email);
        requireOwnedStore(storeId, owner.getId());
        List<JoinRequestResponse> result = new ArrayList<>();
        for (UUID userId : brewRedisService.listJoinRequesterIds(storeId)) {
            userService.findByEmail(findEmailByUserId(userId))
                    .ifPresent(u -> result.add(new JoinRequestResponse(u.getId(), u.getEmail(), u.getNickname())));
        }
        return result;
    }

    @Transactional
    public void approveJoin(String email, UUID storeId, UUID requesterId, ApproveJoinRequest request) {
        User owner = requireUser(email);
        requireOwnedStore(storeId, owner.getId());
        if (!brewRedisService.hasJoinRequest(storeId, requesterId)) {
            throw new BusinessException(HttpStatus.NOT_FOUND, "JOIN_NOT_FOUND", "대기 중인 가입 신청이 없습니다.");
        }
        boolean canEditStock = Boolean.TRUE.equals(request.canEditStock());
        LocalDate workStartDate = request.workStartDate();
        if (workStartDate != null) {
            LocalDate today = BrewShiftTimes.nowSeoul().toLocalDate();
            if (workStartDate.isBefore(today.minusYears(1)) || workStartDate.isAfter(today.plusYears(1))) {
                throw new BusinessException(HttpStatus.BAD_REQUEST, "WORK_START_OUT_OF_RANGE", "근무 시작일은 오늘 기준 1년 이내여야 합니다.");
            }
        }
        if (!subscriptionRepository.existsBySubscriberUserIdAndStoreId(requesterId, storeId)) {
            subscriptionRepository.save(BrewStoreSubscription.builder()
                    .subscriberUserId(requesterId)
                    .storeId(storeId)
                    .canEditStock(canEditStock)
                    .workStartDate(workStartDate)
                    .build());
        } else {
            BrewStoreSubscription existing = subscriptionRepository
                    .findBySubscriberUserIdAndStoreId(requesterId, storeId)
                    .orElseThrow();
            existing.setCanEditStock(canEditStock);
            existing.setWorkStartDate(workStartDate);
            subscriptionRepository.save(existing);
        }
        List<ScheduleSlotRequest> slots = request.slots() == null ? List.of() : request.slots();
        brewScheduleService.replaceSchedules(
                email,
                storeId,
                requesterId,
                new ReplaceSchedulesRequest(
                        slots,
                        ScheduleReplaceMode.FROM_DATE,
                        workStartDate != null ? workStartDate : BrewShiftTimes.nowSeoul().toLocalDate()
                )
        );
        brewRedisService.deleteJoinRequest(storeId, requesterId);
    }

    @Transactional
    public List<SubscriberResponse> listSubscribers(String email, UUID storeId) {
        User owner = requireUser(email);
        requireOwnedStore(storeId, owner.getId());
        processDueLeavesForStore(storeId);
        List<BrewStoreSubscription> subs =
                subscriptionRepository.findByStoreIdOrderByCreatedAtDesc(storeId);
        if (subs.isEmpty()) {
            return List.of();
        }
        Map<UUID, User> usersById = userService
                .findAllById(subs.stream().map(BrewStoreSubscription::getSubscriberUserId).toList())
                .stream()
                .collect(Collectors.toMap(User::getId, Function.identity(), (a, b) -> a));
        List<SubscriberResponse> result = new ArrayList<>(subs.size());
        for (BrewStoreSubscription sub : subs) {
            User subscriber = usersById.get(sub.getSubscriberUserId());
            if (subscriber != null) {
                result.add(toSubscriberResponse(subscriber, sub));
            }
        }
        return result;
    }

    @Transactional
    public SubscriberResponse updateSubscriberStockPermission(
            String email,
            UUID storeId,
            UUID subscriberId,
            StockPermissionRequest request
    ) {
        User owner = requireUser(email);
        requireOwnedStore(storeId, owner.getId());
        processDueLeavesForStore(storeId);
        BrewStoreSubscription sub = subscriptionRepository
                .findBySubscriberUserIdAndStoreId(subscriberId, storeId)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "SUBSCRIBER_NOT_FOUND", "구독자를 찾을 수 없습니다."));
        sub.setCanEditStock(Boolean.TRUE.equals(request.canEditStock()));
        subscriptionRepository.save(sub);
        User subscriber = userService.findById(subscriberId)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "USER_NOT_FOUND", "회원을 찾을 수 없습니다."));
        return toSubscriberResponse(subscriber, sub);
    }

    @Transactional
    public void rejectJoin(String email, UUID storeId, UUID requesterId) {
        User owner = requireUser(email);
        requireOwnedStore(storeId, owner.getId());
        brewRedisService.deleteJoinRequest(storeId, requesterId);
    }

    /**
     * 업주가 직원 퇴사 처리. leaveDate = 마지막 근무일.
     * 이미 지난 날이면 즉시 해제, 오늘 이후면 예약.
     */
    @Transactional
    public SubscriberResponse resignSubscriber(
            String email,
            UUID storeId,
            UUID subscriberId,
            LeaveDateRequest request
    ) {
        User owner = requireUser(email);
        requireOwnedStore(storeId, owner.getId());
        processDueLeavesForStore(storeId);
        return applyLeave(storeId, subscriberId, request.leaveDate(), owner.getId(), true);
    }

    /** 직원이 스스로 퇴사(가게 나가기) — 업주만 지정. */
    @Transactional
    public void unsubscribe(String email, UUID storeId, LeaveDateRequest request) {
        PosAccess.forbidManagement();
        requireUser(email);
        requireStore(storeId);
        throw new BusinessException(HttpStatus.FORBIDDEN, "OWNER_RESIGN_ONLY", "퇴사는 사장님만 지정할 수 있습니다.");
    }

    /** 예약된 퇴사 취소 */
    @Transactional
    public SubscriberResponse clearScheduledLeave(
            String email,
            UUID storeId,
            UUID subscriberId
    ) {
        User actor = requireUser(email);
        requireOwnedStore(storeId, actor.getId());
        BrewStoreSubscription sub = subscriptionRepository
                .findBySubscriberUserIdAndStoreId(subscriberId, storeId)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "SUBSCRIBER_NOT_FOUND", "구독자를 찾을 수 없습니다."));
        sub.clearLeave();
        subscriptionRepository.save(sub);
        User subscriber = userService.findById(subscriberId)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "USER_NOT_FOUND", "회원을 찾을 수 없습니다."));
        return toSubscriberResponse(subscriber, sub);
    }

    /** 직원이 본인 퇴사 예약 취소 — 업주만 지정. */
    @Transactional
    public void clearMyScheduledLeave(String email, UUID storeId) {
        requireUser(email);
        requireStore(storeId);
        throw new BusinessException(HttpStatus.FORBIDDEN, "OWNER_RESIGN_ONLY", "퇴사는 사장님만 지정할 수 있습니다.");
    }

    private SubscriberResponse applyLeave(
            UUID storeId,
            UUID subscriberId,
            LocalDate leaveDate,
            UUID decidedByUserId,
            boolean returnResponseIfScheduled
    ) {
        if (leaveDate == null) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "LEAVE_DATE_REQUIRED", "퇴사일을 입력해 주세요.");
        }
        LocalDate today = BrewShiftTimes.nowSeoul().toLocalDate();
        if (leaveDate.isBefore(today.minusYears(1)) || leaveDate.isAfter(today.plusYears(1))) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "LEAVE_DATE_OUT_OF_RANGE", "퇴사일은 오늘 기준 1년 이내여야 합니다.");
        }
        BrewStoreSubscription sub = subscriptionRepository
                .findBySubscriberUserIdAndStoreId(subscriberId, storeId)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "SUBSCRIBER_NOT_FOUND", "구독자를 찾을 수 없습니다."));

        if (leaveDate.isBefore(today)) {
            finalizeLeave(storeId, subscriberId, leaveDate);
            return null;
        }

        sub.scheduleLeave(leaveDate);
        subscriptionRepository.save(sub);
        brewScheduleService.deleteCoversAfterLeaveDate(storeId, subscriberId, leaveDate);
        if (!returnResponseIfScheduled) {
            return null;
        }
        User subscriber = userService.findById(subscriberId)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "USER_NOT_FOUND", "회원을 찾을 수 없습니다."));
        return toSubscriberResponse(subscriber, sub);
    }

    private void processDueLeavesForStore(UUID storeId) {
        LocalDate today = BrewShiftTimes.nowSeoul().toLocalDate();
        for (BrewStoreSubscription sub :
                subscriptionRepository.findByStoreIdAndLeaveDateBefore(storeId, today)) {
            LocalDate leaveDate = sub.getLeaveDate();
            if (leaveDate != null) {
                finalizeLeave(storeId, sub.getSubscriberUserId(), leaveDate);
            }
        }
    }

    private void finalizeLeave(UUID storeId, UUID userId, LocalDate leaveDate) {
        brewScheduleService.purgeStaffMembership(storeId, userId, leaveDate);
        subscriptionRepository.deleteBySubscriberUserIdAndStoreId(userId, storeId);
    }

    private SubscriberResponse toSubscriberResponse(User user, BrewStoreSubscription sub) {
        return new SubscriberResponse(
                user.getId(),
                user.getEmail(),
                user.getNickname(),
                sub.isCanEditStock(),
                sub.getWorkStartDate(),
                sub.getLeaveDate(),
                sub.getCreatedAt()
        );
    }

    private StoreResponse toStoreResponse(BrewStore store, UUID viewerId) {
        if (PosAccess.isPos()) {
            PosAccess.requireBoundStore(store.getId());
            PosAccess.Snapshot pos = PosAccess.require();
            return new StoreResponse(
                    store.getId(),
                    store.getOwnerUserId(),
                    store.getName(),
                    store.isPublic(),
                    null,
                    false,
                    true,
                    pos.canEditStock(),
                    true,
                    store.isStockEditOffDuty(),
                    store.isStockUsageHint(),
                    null,
                    store.getCreatedAt(),
                    store.getUpdatedAt());
        }
        boolean subscribed = false;
        boolean canEditStock = false;
        boolean onDuty = false;
        LocalDate leaveDate = null;
        if (viewerId != null) {
            if (store.getOwnerUserId().equals(viewerId)) {
                canEditStock = true;
                onDuty = brewScheduleService.isCurrentlyOnDuty(store.getId(), viewerId);
            } else {
                var subOpt = subscriptionRepository
                        .findBySubscriberUserIdAndStoreId(viewerId, store.getId());
                if (subOpt.isPresent()) {
                    BrewStoreSubscription sub = subOpt.get();
                    if (sub.isLeaveDue(BrewShiftTimes.nowSeoul().toLocalDate())) {
                        LocalDate dueLeave = sub.getLeaveDate();
                        if (dueLeave != null) {
                            finalizeLeave(store.getId(), viewerId, dueLeave);
                        }
                    } else {
                        subscribed = true;
                        canEditStock = sub.isCanEditStock();
                        leaveDate = sub.getLeaveDate();
                        onDuty = brewScheduleService.isCurrentlyOnDuty(store.getId(), viewerId);
                    }
                }
            }
        }
        return StoreResponse.from(store, viewerId, subscribed, canEditStock, onDuty, leaveDate);
    }

    /**
     * List path: batch subscriptions + onDuty. Does not finalize due leaves (read-only lists).
     */
    private List<StoreResponse> toStoreResponsesBatch(List<BrewStore> stores, UUID viewerId) {
        if (stores.isEmpty()) {
            return List.of();
        }
        if (viewerId == null) {
            return stores.stream()
                    .map(store -> StoreResponse.from(store, null, false, false, false, null))
                    .toList();
        }

        List<UUID> storeIds = stores.stream().map(BrewStore::getId).toList();
        Map<UUID, BrewStoreSubscription> subsByStore = subscriptionRepository
                .findBySubscriberUserIdAndStoreIdIn(viewerId, storeIds)
                .stream()
                .collect(Collectors.toMap(
                        BrewStoreSubscription::getStoreId,
                        Function.identity(),
                        (a, b) -> a));

        LocalDate today = BrewShiftTimes.nowSeoul().toLocalDate();
        List<UUID> dutyCandidateIds = new ArrayList<>();
        for (BrewStore store : stores) {
            if (store.getOwnerUserId().equals(viewerId)) {
                dutyCandidateIds.add(store.getId());
                continue;
            }
            BrewStoreSubscription sub = subsByStore.get(store.getId());
            if (sub != null && !sub.isLeaveDue(today)) {
                dutyCandidateIds.add(store.getId());
            }
        }
        Map<UUID, Boolean> onDutyByStore = brewScheduleService.onDutyByStoreIds(
                viewerId,
                dutyCandidateIds,
                subsByStore);

        List<StoreResponse> result = new ArrayList<>(stores.size());
        for (BrewStore store : stores) {
            boolean owned = store.getOwnerUserId().equals(viewerId);
            boolean subscribed = false;
            boolean canEditStock = false;
            LocalDate leaveDate = null;
            boolean onDuty = Boolean.TRUE.equals(onDutyByStore.get(store.getId()));
            if (owned) {
                canEditStock = true;
            } else {
                BrewStoreSubscription sub = subsByStore.get(store.getId());
                if (sub != null && !sub.isLeaveDue(today)) {
                    subscribed = true;
                    canEditStock = sub.isCanEditStock();
                    leaveDate = sub.getLeaveDate();
                }
            }
            result.add(StoreResponse.from(
                    store, viewerId, subscribed, canEditStock, onDuty, leaveDate));
        }
        return result;
    }

    private void assertCanView(BrewStore store, UUID viewerId) {
        if (PosAccess.isPos()) {
            PosAccess.requireBoundStore(store.getId());
            return;
        }
        if (store.isPublic()) {
            return;
        }
        if (viewerId == null) {
            throw new BusinessException(HttpStatus.FORBIDDEN, "PRIVATE_STORE_LOGIN", "비공개 가게입니다. 로그인이 필요합니다.");
        }
        if (store.getOwnerUserId().equals(viewerId)) {
            return;
        }
        if (subscriptionRepository.existsBySubscriberUserIdAndStoreId(viewerId, store.getId())) {
            return;
        }
        throw new BusinessException(HttpStatus.FORBIDDEN, "VIEW_MEMBERS_ONLY", "구독 또는 소유자만 열람할 수 있습니다.");
    }

    private void assertMember(BrewStore store, UUID userId) {
        if (PosAccess.isPos()) {
            PosAccess.requireBoundStore(store.getId());
            return;
        }
        if (store.getOwnerUserId().equals(userId)) {
            return;
        }
        if (subscriptionRepository.existsBySubscriberUserIdAndStoreId(userId, store.getId())) {
            return;
        }
        throw new BusinessException(HttpStatus.FORBIDDEN, "MEMBERS_ONLY", "가게 구성원만 이용할 수 있습니다.");
    }

    private User requireUser(String email) {
        return userService.findByEmail(email.trim().toLowerCase())
                .orElseThrow(() -> new BusinessException(HttpStatus.UNAUTHORIZED, "LOGIN_REQUIRED", "로그인이 필요합니다."));
    }

    private UUID resolveUserId(String emailOrNull) {
        if (emailOrNull == null || emailOrNull.isBlank()) {
            return null;
        }
        return userService.findByEmail(emailOrNull.trim().toLowerCase())
                .map(User::getId)
                .orElse(null);
    }

    private BrewStore requireStore(UUID storeId) {
        return storeRepository.findById(storeId)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "STORE_NOT_FOUND", "가게를 찾을 수 없습니다."));
    }

    private BrewStore requireOwnedStore(UUID storeId, UUID ownerId) {
        PosAccess.forbidManagement();
        BrewStore store = requireStore(storeId);
        if (!store.getOwnerUserId().equals(ownerId)) {
            throw new BusinessException(HttpStatus.FORBIDDEN, "OWNER_ONLY", "가게 소유자만 관리할 수 있습니다.");
        }
        return store;
    }

    private BrewMenu requireMenu(UUID menuId) {
        return menuRepository.findById(menuId)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "MENU_NOT_FOUND", "메뉴를 찾을 수 없습니다."));
    }

    private BrewRecipe requireRecipe(UUID recipeId) {
        return recipeRepository.findById(recipeId)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "RECIPE_NOT_FOUND", "레시피를 찾을 수 없습니다."));
    }

    private String findEmailByUserId(UUID userId) {
        // UserService has findByEmail only; use repository via scanning subscriptions path
        // Add findById on UserService if missing
        return userService.findById(userId)
                .map(User::getEmail)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "USER_NOT_FOUND", "회원을 찾을 수 없습니다."));
    }
}
