package com.studiobs.spring_backend.domain.brew.service;

import com.studiobs.spring_backend.domain.brew.dto.ApproveJoinRequest;
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
import com.studiobs.spring_backend.domain.brew.dto.ScheduleSlotRequest;
import com.studiobs.spring_backend.domain.brew.dto.StockCategoryResponse;
import com.studiobs.spring_backend.domain.brew.dto.StockPermissionRequest;
import com.studiobs.spring_backend.domain.brew.dto.StockRequest;
import com.studiobs.spring_backend.domain.brew.dto.StockResponse;
import com.studiobs.spring_backend.domain.brew.dto.StoreResponse;
import com.studiobs.spring_backend.domain.brew.dto.SubscriberResponse;
import com.studiobs.spring_backend.domain.brew.dto.UpdateStoreRequest;
import com.studiobs.spring_backend.domain.brew.entity.BrewMenu;
import com.studiobs.spring_backend.domain.brew.entity.BrewRecipe;
import com.studiobs.spring_backend.domain.brew.entity.BrewStore;
import com.studiobs.spring_backend.domain.brew.entity.BrewStoreNotice;
import com.studiobs.spring_backend.domain.brew.entity.BrewStoreStock;
import com.studiobs.spring_backend.domain.brew.entity.BrewStoreStockCategory;
import com.studiobs.spring_backend.domain.brew.entity.BrewStoreSubscription;
import com.studiobs.spring_backend.domain.brew.repository.BrewMenuRepository;
import com.studiobs.spring_backend.domain.brew.repository.BrewRecipeRepository;
import com.studiobs.spring_backend.domain.brew.repository.BrewStoreNoticeRepository;
import com.studiobs.spring_backend.domain.brew.repository.BrewStoreRepository;
import com.studiobs.spring_backend.domain.brew.repository.BrewStoreStockCategoryRepository;
import com.studiobs.spring_backend.domain.brew.repository.BrewStoreStockRepository;
import com.studiobs.spring_backend.domain.brew.repository.BrewStoreSubscriptionRepository;
import com.studiobs.spring_backend.domain.brew.support.BrewInviteCodes;
import com.studiobs.spring_backend.domain.brew.support.BrewShiftTimes;
import com.studiobs.spring_backend.domain.user.entity.User;
import com.studiobs.spring_backend.domain.user.service.UserService;
import com.studiobs.spring_backend.global.exception.BusinessException;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
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
    private final BrewStoreStockCategoryRepository stockCategoryRepository;
    private final BrewStoreStockRepository stockRepository;
    private final BrewStoreNoticeRepository noticeRepository;
    private final BrewRedisService brewRedisService;
    private final BrewScheduleService brewScheduleService;

    @Transactional(readOnly = true)
    public List<StoreResponse> listMyStores(String email) {
        User user = requireUser(email);
        return storeRepository.findByOwnerUserIdOrderByUpdatedAtDesc(user.getId()).stream()
                .map(store -> StoreResponse.from(store, user.getId(), false, false, true, null))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<StoreResponse> listPublicStores(String emailOrNull) {
        UUID viewerId = resolveUserId(emailOrNull);
        return storeRepository.findByIsPublicTrueOrderByUpdatedAtDesc().stream()
                .map(store -> toStoreResponse(store, viewerId))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<StoreResponse> searchStores(String emailOrNull, String query) {
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
        return unique.values().stream()
                .map(store -> toStoreResponse(store, viewerId))
                .toList();
    }

    @Transactional
    public List<StoreResponse> listSubscriptions(String email) {
        User user = requireUser(email);
        List<BrewStoreSubscription> subs =
                subscriptionRepository.findBySubscriberUserIdOrderByCreatedAtDesc(user.getId());
        List<StoreResponse> result = new ArrayList<>();
        for (BrewStoreSubscription sub : subs) {
            processDueLeaveIfNeeded(sub, user.getId());
            if (!subscriptionRepository.existsBySubscriberUserIdAndStoreId(user.getId(), sub.getStoreId())) {
                continue;
            }
            BrewStoreSubscription fresh = subscriptionRepository
                    .findBySubscriberUserIdAndStoreId(user.getId(), sub.getStoreId())
                    .orElse(null);
            if (fresh == null) {
                continue;
            }
            BrewStore store = storeRepository.findById(fresh.getStoreId()).orElse(null);
            if (store == null) {
                continue;
            }
            result.add(StoreResponse.from(
                    store,
                    user.getId(),
                    true,
                    fresh.isCanEditStock(),
                    false,
                    fresh.getLeaveDate()));
        }
        return result;
    }

    @Transactional
    public StoreResponse createStore(String email, CreateStoreRequest request) {
        User user = requireUser(email);
        BrewStore store = storeRepository.save(BrewStore.builder()
                .ownerUserId(user.getId())
                .name(request.name().trim())
                .isPublic(request.isPublic())
                .inviteCode(allocateInviteCode())
                .build());
        return StoreResponse.from(store, user.getId(), false, false, true, null);
    }

    @Transactional
    public StoreResponse regenerateInviteCode(String email, UUID storeId) {
        User user = requireUser(email);
        BrewStore store = requireOwnedStore(storeId, user.getId());
        store.rotateInviteCode(allocateInviteCode());
        return StoreResponse.from(storeRepository.save(store), user.getId(), false, false, true, null);
    }

    private String allocateInviteCode() {
        for (int attempt = 0; attempt < 32; attempt += 1) {
            String code = BrewInviteCodes.generate();
            if (!storeRepository.existsByInviteCodeIgnoreCase(code)) {
                return code;
            }
        }
        throw new BusinessException(HttpStatus.INTERNAL_SERVER_ERROR, "가게 코드 발급에 실패했습니다. 다시 시도해 주세요.");
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
        store.update(request.name().trim(), request.isPublic());
        return StoreResponse.from(storeRepository.save(store), user.getId(), false, false, true, null);
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
    public List<NoticeResponse> listNotices(String email, UUID storeId) {
        User user = requireUser(email);
        BrewStore store = requireStore(storeId);
        assertMember(store, user.getId());
        return noticeRepository.findByStoreIdOrderByCreatedAtDesc(storeId).stream()
                .map(n -> NoticeResponse.from(n, nicknameOf(n.getAuthorUserId())))
                .toList();
    }

    @Transactional
    public NoticeResponse createNotice(String email, UUID storeId, NoticeRequest request) {
        User user = requireUser(email);
        requireOwnedStore(storeId, user.getId());
        BrewStoreNotice notice = noticeRepository.save(BrewStoreNotice.builder()
                .storeId(storeId)
                .authorUserId(user.getId())
                .title(request.title().trim())
                .body(request.body().trim())
                .build());
        return NoticeResponse.from(notice, user.getNickname());
    }

    @Transactional
    public NoticeResponse updateNotice(String email, UUID noticeId, NoticeRequest request) {
        User user = requireUser(email);
        BrewStoreNotice notice = requireNotice(noticeId);
        requireOwnedStore(notice.getStoreId(), user.getId());
        notice.update(request.title().trim(), request.body().trim());
        return NoticeResponse.from(noticeRepository.save(notice), nicknameOf(notice.getAuthorUserId()));
    }

    @Transactional
    public void deleteNotice(String email, UUID noticeId) {
        User user = requireUser(email);
        BrewStoreNotice notice = requireNotice(noticeId);
        requireOwnedStore(notice.getStoreId(), user.getId());
        noticeRepository.delete(notice);
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

    @Transactional(readOnly = true)
    public List<StockCategoryResponse> listStockCategories(UUID storeId, String email) {
        User user = requireUser(email);
        requireStockEditor(storeId, user.getId());
        return stockCategoryRepository.findByStoreIdOrderByCategoryNameAsc(storeId).stream()
                .map(cat -> StockCategoryResponse.from(
                        cat,
                        stockRepository.findByCategoryIdOrderByStockNameAsc(cat.getId())))
                .toList();
    }

    @Transactional
    public StockCategoryResponse createStockCategory(String email, UUID storeId, NameRequest request) {
        User user = requireUser(email);
        requireStockMutator(storeId, user.getId());
        String name = request.name().trim();
        if (stockCategoryRepository.existsByStoreIdAndCategoryName(storeId, name)) {
            throw new BusinessException(HttpStatus.CONFLICT, "이미 있는 카테고리 이름입니다.");
        }
        BrewStoreStockCategory category = stockCategoryRepository.save(
                BrewStoreStockCategory.builder().storeId(storeId).categoryName(name).build());
        return StockCategoryResponse.from(category, List.of());
    }

    @Transactional
    public StockCategoryResponse renameStockCategory(
            String email,
            Integer categoryId,
            NameRequest request
    ) {
        User user = requireUser(email);
        BrewStoreStockCategory category = requireStockCategory(categoryId);
        requireStockMutator(category.getStoreId(), user.getId());
        String name = request.name().trim();
        if (name.isEmpty()) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "카테고리 이름을 입력해 주세요.");
        }
        if (!category.getCategoryName().equalsIgnoreCase(name)
                && stockCategoryRepository.existsByStoreIdAndCategoryName(category.getStoreId(), name)) {
            throw new BusinessException(HttpStatus.CONFLICT, "이미 있는 카테고리 이름입니다.");
        }
        category.rename(name);
        List<BrewStoreStock> stocks = stockRepository.findByCategoryIdOrderByStockNameAsc(categoryId);
        return StockCategoryResponse.from(category, stocks);
    }

    @Transactional
    public void deleteStockCategory(String email, Integer categoryId) {
        User user = requireUser(email);
        BrewStoreStockCategory category = requireStockCategory(categoryId);
        requireStockMutator(category.getStoreId(), user.getId());
        stockCategoryRepository.delete(category);
    }

    @Transactional
    public StockResponse createStock(String email, Integer categoryId, StockRequest request) {
        User user = requireUser(email);
        BrewStoreStockCategory category = requireStockCategory(categoryId);
        requireStockMutator(category.getStoreId(), user.getId());
        validateStockNums(request.stockNum(), request.stockMinNum());
        String name = request.stockName().trim();
        if (stockRepository.existsByCategoryIdAndStockName(categoryId, name)) {
            throw new BusinessException(HttpStatus.CONFLICT, "이미 있는 재고 이름입니다.");
        }
        BrewStoreStock stock = stockRepository.save(BrewStoreStock.builder()
                .categoryId(categoryId)
                .stockName(name)
                .stockNum(request.stockNum())
                .stockMinNum(request.stockMinNum())
                .build());
        return StockResponse.from(stock);
    }

    @Transactional
    public StockResponse updateStock(String email, Integer stockId, StockRequest request) {
        User user = requireUser(email);
        BrewStoreStock stock = requireStock(stockId);
        BrewStoreStockCategory category = requireStockCategory(stock.getCategoryId());
        requireStockMutator(category.getStoreId(), user.getId());
        validateStockNums(request.stockNum(), request.stockMinNum());
        stock.update(request.stockName().trim(), request.stockNum(), request.stockMinNum());
        return StockResponse.from(stockRepository.save(stock));
    }

    @Transactional
    public void deleteStock(String email, Integer stockId) {
        User user = requireUser(email);
        BrewStoreStock stock = requireStock(stockId);
        BrewStoreStockCategory category = requireStockCategory(stock.getCategoryId());
        requireStockMutator(category.getStoreId(), user.getId());
        stockRepository.delete(stock);
    }

    @Transactional
    public void requestJoin(String email, UUID storeId) {
        User user = requireUser(email);
        BrewStore store = requireStore(storeId);
        if (store.getOwnerUserId().equals(user.getId())) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "본인 가게에는 가입 신청할 수 없습니다.");
        }
        if (subscriptionRepository.existsBySubscriberUserIdAndStoreId(user.getId(), storeId)) {
            throw new BusinessException(HttpStatus.CONFLICT, "이미 구독 중인 가게입니다.");
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
            throw new BusinessException(HttpStatus.NOT_FOUND, "대기 중인 가입 신청이 없습니다.");
        }
        boolean canEditStock = Boolean.TRUE.equals(request.canEditStock());
        LocalDate workStartDate = request.workStartDate();
        if (workStartDate != null) {
            LocalDate today = BrewShiftTimes.nowSeoul().toLocalDate();
            if (workStartDate.isBefore(today.minusYears(1)) || workStartDate.isAfter(today.plusYears(1))) {
                throw new BusinessException(HttpStatus.BAD_REQUEST, "근무 시작일은 오늘 기준 1년 이내여야 합니다.");
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
                new ReplaceSchedulesRequest(slots)
        );
        brewRedisService.deleteJoinRequest(storeId, requesterId);
    }

    @Transactional
    public List<SubscriberResponse> listSubscribers(String email, UUID storeId) {
        User owner = requireUser(email);
        requireOwnedStore(storeId, owner.getId());
        processDueLeavesForStore(storeId);
        List<SubscriberResponse> result = new ArrayList<>();
        for (BrewStoreSubscription sub : subscriptionRepository.findByStoreIdOrderByCreatedAtDesc(storeId)) {
            userService.findById(sub.getSubscriberUserId()).ifPresent(u ->
                    result.add(toSubscriberResponse(u, sub)));
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
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "구독자를 찾을 수 없습니다."));
        sub.setCanEditStock(Boolean.TRUE.equals(request.canEditStock()));
        subscriptionRepository.save(sub);
        User subscriber = userService.findById(subscriberId)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "회원을 찾을 수 없습니다."));
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

    /** 직원이 스스로 퇴사(가게 나가기) */
    @Transactional
    public void unsubscribe(String email, UUID storeId, LeaveDateRequest request) {
        User user = requireUser(email);
        processDueLeavesForStore(storeId);
        BrewStore store = requireStore(storeId);
        if (store.getOwnerUserId().equals(user.getId())) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "업주는 구독을 해지할 수 없습니다. 가게를 삭제하세요.");
        }
        applyLeave(storeId, user.getId(), request.leaveDate(), user.getId(), false);
    }

    /** 예약된 퇴사 취소 */
    @Transactional
    public SubscriberResponse clearScheduledLeave(
            String email,
            UUID storeId,
            UUID subscriberId
    ) {
        User actor = requireUser(email);
        BrewStore store = requireStore(storeId);
        boolean isOwner = store.getOwnerUserId().equals(actor.getId());
        if (!isOwner && !actor.getId().equals(subscriberId)) {
            throw new BusinessException(HttpStatus.FORBIDDEN, "본인 또는 업주만 퇴사 예약을 취소할 수 있습니다.");
        }
        if (isOwner) {
            requireOwnedStore(storeId, actor.getId());
        }
        BrewStoreSubscription sub = subscriptionRepository
                .findBySubscriberUserIdAndStoreId(subscriberId, storeId)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "구독자를 찾을 수 없습니다."));
        sub.clearLeave();
        subscriptionRepository.save(sub);
        User subscriber = userService.findById(subscriberId)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "회원을 찾을 수 없습니다."));
        return toSubscriberResponse(subscriber, sub);
    }

    /** 직원이 본인 퇴사 예약 취소 */
    @Transactional
    public void clearMyScheduledLeave(String email, UUID storeId) {
        User user = requireUser(email);
        clearScheduledLeave(email, storeId, user.getId());
    }

    private SubscriberResponse applyLeave(
            UUID storeId,
            UUID subscriberId,
            LocalDate leaveDate,
            UUID decidedByUserId,
            boolean returnResponseIfScheduled
    ) {
        if (leaveDate == null) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "퇴사일을 입력해 주세요.");
        }
        LocalDate today = BrewShiftTimes.nowSeoul().toLocalDate();
        if (leaveDate.isBefore(today.minusYears(1)) || leaveDate.isAfter(today.plusYears(1))) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "퇴사일은 오늘 기준 1년 이내여야 합니다.");
        }
        BrewStoreSubscription sub = subscriptionRepository
                .findBySubscriberUserIdAndStoreId(subscriberId, storeId)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "구독자를 찾을 수 없습니다."));

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
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "회원을 찾을 수 없습니다."));
        return toSubscriberResponse(subscriber, sub);
    }

    private void processDueLeavesForStore(UUID storeId) {
        LocalDate today = BrewShiftTimes.nowSeoul().toLocalDate();
        for (BrewStoreSubscription sub : subscriptionRepository.findByStoreIdOrderByCreatedAtDesc(storeId)) {
            if (sub.isLeaveDue(today)) {
                LocalDate leaveDate = sub.getLeaveDate();
                if (leaveDate != null) {
                    finalizeLeave(storeId, sub.getSubscriberUserId(), leaveDate);
                }
            }
        }
    }

    private void processDueLeaveIfNeeded(BrewStoreSubscription sub, UUID decidedByUserId) {
        LocalDate today = BrewShiftTimes.nowSeoul().toLocalDate();
        if (sub.isLeaveDue(today) && sub.getLeaveDate() != null) {
            finalizeLeave(sub.getStoreId(), sub.getSubscriberUserId(), sub.getLeaveDate());
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

    private void requireStockEditor(UUID storeId, UUID userId) {
        BrewStore store = requireStore(storeId);
        if (store.getOwnerUserId().equals(userId)) {
            return;
        }
        boolean allowed = subscriptionRepository
                .findBySubscriberUserIdAndStoreId(userId, storeId)
                .map(BrewStoreSubscription::isCanEditStock)
                .orElse(false);
        if (!allowed) {
            throw new BusinessException(HttpStatus.FORBIDDEN, "재고 수정 권한이 없습니다.");
        }
    }

    private void requireStockMutator(UUID storeId, UUID userId) {
        requireStockEditor(storeId, userId);
        BrewStore store = requireStore(storeId);
        if (store.getOwnerUserId().equals(userId)) {
            return;
        }
        if (!brewScheduleService.isCurrentlyOnDuty(storeId, userId)) {
            throw new BusinessException(
                    HttpStatus.FORBIDDEN,
                    "근무 시간에만 재고를 수정할 수 있습니다."
            );
        }
    }

    private StoreResponse toStoreResponse(BrewStore store, UUID viewerId) {
        boolean subscribed = false;
        boolean canEditStock = false;
        boolean onDuty = false;
        LocalDate leaveDate = null;
        if (viewerId != null) {
            if (store.getOwnerUserId().equals(viewerId)) {
                canEditStock = true;
                onDuty = true;
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
                        if (canEditStock) {
                            onDuty = brewScheduleService.isCurrentlyOnDuty(store.getId(), viewerId);
                        }
                    }
                }
            }
        }
        return StoreResponse.from(store, viewerId, subscribed, canEditStock, onDuty, leaveDate);
    }

    private void assertCanView(BrewStore store, UUID viewerId) {
        if (store.isPublic()) {
            return;
        }
        if (viewerId == null) {
            throw new BusinessException(HttpStatus.FORBIDDEN, "비공개 가게입니다. 로그인이 필요합니다.");
        }
        if (store.getOwnerUserId().equals(viewerId)) {
            return;
        }
        if (subscriptionRepository.existsBySubscriberUserIdAndStoreId(viewerId, store.getId())) {
            return;
        }
        throw new BusinessException(HttpStatus.FORBIDDEN, "구독 또는 소유자만 열람할 수 있습니다.");
    }

    private void assertMember(BrewStore store, UUID userId) {
        if (store.getOwnerUserId().equals(userId)) {
            return;
        }
        if (subscriptionRepository.existsBySubscriberUserIdAndStoreId(userId, store.getId())) {
            return;
        }
        throw new BusinessException(HttpStatus.FORBIDDEN, "가게 구성원만 이용할 수 있습니다.");
    }

    private String nicknameOf(UUID userId) {
        return userService.findById(userId).map(User::getNickname).orElse("");
    }

    private BrewStoreNotice requireNotice(UUID noticeId) {
        return noticeRepository.findById(noticeId)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "공지를 찾을 수 없습니다."));
    }

    private User requireUser(String email) {
        return userService.findByEmail(email.trim().toLowerCase())
                .orElseThrow(() -> new BusinessException(HttpStatus.UNAUTHORIZED, "로그인이 필요합니다."));
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
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "가게를 찾을 수 없습니다."));
    }

    private BrewStore requireOwnedStore(UUID storeId, UUID ownerId) {
        BrewStore store = requireStore(storeId);
        if (!store.getOwnerUserId().equals(ownerId)) {
            throw new BusinessException(HttpStatus.FORBIDDEN, "가게 소유자만 관리할 수 있습니다.");
        }
        return store;
    }

    private BrewMenu requireMenu(UUID menuId) {
        return menuRepository.findById(menuId)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "메뉴를 찾을 수 없습니다."));
    }

    private BrewRecipe requireRecipe(UUID recipeId) {
        return recipeRepository.findById(recipeId)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "레시피를 찾을 수 없습니다."));
    }

    private BrewStoreStockCategory requireStockCategory(Integer categoryId) {
        return stockCategoryRepository.findById(categoryId)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "재고 카테고리를 찾을 수 없습니다."));
    }

    private BrewStoreStock requireStock(Integer stockId) {
        return stockRepository.findById(stockId)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "재고를 찾을 수 없습니다."));
    }

    private void validateStockNums(int stockNum, Integer stockMinNum) {
        if (stockNum < 0) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "재고 수량은 0 이상이어야 합니다.");
        }
        if (stockMinNum != null && stockMinNum < 0) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "경고 수량은 0 이상이어야 합니다.");
        }
    }

    private String findEmailByUserId(UUID userId) {
        // UserService has findByEmail only; use repository via scanning subscriptions path
        // Add findById on UserService if missing
        return userService.findById(userId)
                .map(User::getEmail)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "회원을 찾을 수 없습니다."));
    }
}
