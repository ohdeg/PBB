package com.studiobs.spring_backend.domain.brew.service;

import com.studiobs.spring_backend.domain.brew.dto.CreateStoreRequest;
import com.studiobs.spring_backend.domain.brew.dto.JoinRequestResponse;
import com.studiobs.spring_backend.domain.brew.dto.MenuResponse;
import com.studiobs.spring_backend.domain.brew.dto.NameRequest;
import com.studiobs.spring_backend.domain.brew.dto.RecipeContentsRequest;
import com.studiobs.spring_backend.domain.brew.dto.RecipeResponse;
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
import com.studiobs.spring_backend.domain.brew.entity.BrewStoreStock;
import com.studiobs.spring_backend.domain.brew.entity.BrewStoreStockCategory;
import com.studiobs.spring_backend.domain.brew.entity.BrewStoreSubscription;
import com.studiobs.spring_backend.domain.brew.repository.BrewMenuRepository;
import com.studiobs.spring_backend.domain.brew.repository.BrewRecipeRepository;
import com.studiobs.spring_backend.domain.brew.repository.BrewStoreRepository;
import com.studiobs.spring_backend.domain.brew.repository.BrewStoreStockCategoryRepository;
import com.studiobs.spring_backend.domain.brew.repository.BrewStoreStockRepository;
import com.studiobs.spring_backend.domain.brew.repository.BrewStoreSubscriptionRepository;
import com.studiobs.spring_backend.domain.user.entity.User;
import com.studiobs.spring_backend.domain.user.service.UserService;
import com.studiobs.spring_backend.global.exception.BusinessException;
import java.util.ArrayList;
import java.util.List;
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
    private final BrewRedisService brewRedisService;
    private final BrewScheduleService brewScheduleService;

    @Transactional(readOnly = true)
    public List<StoreResponse> listMyStores(String email) {
        User user = requireUser(email);
        return storeRepository.findByOwnerUserIdOrderByUpdatedAtDesc(user.getId()).stream()
                .map(store -> StoreResponse.from(store, user.getId(), false, false, true))
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
        return storeRepository
                .findByNameContainingIgnoreCaseOrderByUpdatedAtDesc(q)
                .stream()
                .map(store -> toStoreResponse(store, viewerId))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<StoreResponse> listSubscriptions(String email) {
        User user = requireUser(email);
        return subscriptionRepository.findBySubscriberUserIdOrderByCreatedAtDesc(user.getId()).stream()
                .map(sub -> {
                    BrewStore store = storeRepository.findById(sub.getStoreId()).orElse(null);
                    if (store == null) {
                        return null;
                    }
                    return StoreResponse.from(store, user.getId(), true, sub.isCanEditStock(), false);
                })
                .filter(store -> store != null)
                .toList();
    }

    @Transactional
    public StoreResponse createStore(String email, CreateStoreRequest request) {
        User user = requireUser(email);
        BrewStore store = storeRepository.save(BrewStore.builder()
                .ownerUserId(user.getId())
                .name(request.name().trim())
                .isPublic(request.isPublic())
                .build());
        return StoreResponse.from(store, user.getId(), false, false, true);
    }

    @Transactional(readOnly = true)
    public StoreResponse getStore(UUID storeId, String emailOrNull) {
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
        return StoreResponse.from(storeRepository.save(store), user.getId(), false, false, true);
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
    public void approveJoin(String email, UUID storeId, UUID requesterId) {
        User owner = requireUser(email);
        requireOwnedStore(storeId, owner.getId());
        if (!brewRedisService.hasJoinRequest(storeId, requesterId)) {
            throw new BusinessException(HttpStatus.NOT_FOUND, "대기 중인 가입 신청이 없습니다.");
        }
        if (!subscriptionRepository.existsBySubscriberUserIdAndStoreId(requesterId, storeId)) {
            subscriptionRepository.save(BrewStoreSubscription.builder()
                    .subscriberUserId(requesterId)
                    .storeId(storeId)
                    .canEditStock(false)
                    .build());
        }
        brewRedisService.deleteJoinRequest(storeId, requesterId);
    }

    @Transactional(readOnly = true)
    public List<SubscriberResponse> listSubscribers(String email, UUID storeId) {
        User owner = requireUser(email);
        requireOwnedStore(storeId, owner.getId());
        List<SubscriberResponse> result = new ArrayList<>();
        for (BrewStoreSubscription sub : subscriptionRepository.findByStoreIdOrderByCreatedAtDesc(storeId)) {
            userService.findById(sub.getSubscriberUserId()).ifPresent(u ->
                    result.add(new SubscriberResponse(
                            u.getId(),
                            u.getEmail(),
                            u.getNickname(),
                            sub.isCanEditStock(),
                            sub.getCreatedAt())));
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
        BrewStoreSubscription sub = subscriptionRepository
                .findBySubscriberUserIdAndStoreId(subscriberId, storeId)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "구독자를 찾을 수 없습니다."));
        sub.setCanEditStock(Boolean.TRUE.equals(request.canEditStock()));
        subscriptionRepository.save(sub);
        User subscriber = userService.findById(subscriberId)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "회원을 찾을 수 없습니다."));
        return new SubscriberResponse(
                subscriber.getId(),
                subscriber.getEmail(),
                subscriber.getNickname(),
                sub.isCanEditStock(),
                sub.getCreatedAt());
    }

    @Transactional
    public void rejectJoin(String email, UUID storeId, UUID requesterId) {
        User owner = requireUser(email);
        requireOwnedStore(storeId, owner.getId());
        brewRedisService.deleteJoinRequest(storeId, requesterId);
    }

    @Transactional
    public void unsubscribe(String email, UUID storeId) {
        User user = requireUser(email);
        subscriptionRepository.deleteBySubscriberUserIdAndStoreId(user.getId(), storeId);
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
        boolean subscribed = viewerId != null
                && subscriptionRepository.existsBySubscriberUserIdAndStoreId(viewerId, store.getId());
        boolean canEditStock = false;
        boolean onDuty = false;
        if (viewerId != null) {
            if (store.getOwnerUserId().equals(viewerId)) {
                canEditStock = true;
                onDuty = true;
            } else {
                canEditStock = subscriptionRepository
                        .findBySubscriberUserIdAndStoreId(viewerId, store.getId())
                        .map(BrewStoreSubscription::isCanEditStock)
                        .orElse(false);
                if (canEditStock) {
                    onDuty = brewScheduleService.isCurrentlyOnDuty(store.getId(), viewerId);
                }
            }
        }
        return StoreResponse.from(store, viewerId, subscribed, canEditStock, onDuty);
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
