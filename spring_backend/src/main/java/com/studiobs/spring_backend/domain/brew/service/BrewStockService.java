package com.studiobs.spring_backend.domain.brew.service;

import com.studiobs.spring_backend.domain.brew.dto.NameRequest;
import com.studiobs.spring_backend.domain.brew.dto.StockCategoryResponse;
import com.studiobs.spring_backend.domain.brew.dto.StockLogResponse;
import com.studiobs.spring_backend.domain.brew.dto.StockRequest;
import com.studiobs.spring_backend.domain.brew.dto.StockResponse;
import com.studiobs.spring_backend.domain.brew.entity.BrewStore;
import com.studiobs.spring_backend.domain.brew.entity.BrewStoreStock;
import com.studiobs.spring_backend.domain.brew.entity.BrewStoreStockCategory;
import com.studiobs.spring_backend.domain.brew.entity.BrewStoreStockLog;
import com.studiobs.spring_backend.domain.brew.entity.BrewStoreSubscription;
import com.studiobs.spring_backend.domain.brew.entity.BrewStoreStockUsageDay;
import com.studiobs.spring_backend.domain.brew.repository.BrewStoreRepository;
import com.studiobs.spring_backend.domain.brew.repository.BrewStoreStockCategoryRepository;
import com.studiobs.spring_backend.domain.brew.repository.BrewStoreStockLogRepository;
import com.studiobs.spring_backend.domain.brew.repository.BrewStoreStockRepository;
import com.studiobs.spring_backend.domain.brew.repository.BrewStoreStockUsageDayRepository;
import com.studiobs.spring_backend.domain.brew.repository.BrewStoreSubscriptionRepository;
import com.studiobs.spring_backend.domain.brew.support.BrewShiftTimes;
import com.studiobs.spring_backend.domain.brew.support.BrewStockUsageForecast;
import com.studiobs.spring_backend.domain.brew.support.BrewStockUsageForecast.Forecast;
import com.studiobs.spring_backend.domain.brew.support.PosAccess;
import com.studiobs.spring_backend.domain.user.entity.User;
import com.studiobs.spring_backend.domain.user.service.UserService;
import com.studiobs.spring_backend.global.exception.BusinessException;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class BrewStockService {

    private final UserService userService;
    private final BrewStoreRepository storeRepository;
    private final BrewStoreSubscriptionRepository subscriptionRepository;
    private final BrewStoreStockCategoryRepository stockCategoryRepository;
    private final BrewStoreStockRepository stockRepository;
    private final BrewStoreStockLogRepository stockLogRepository;
    private final BrewStoreStockUsageDayRepository usageDayRepository;
    private final BrewScheduleService brewScheduleService;
    private final VevenoStockCheckService stockCheckService;

    private static final int UNIT_MAX_LEN = 16;

    @Transactional(readOnly = true)
    public List<StockCategoryResponse> listStockCategories(UUID storeId, String email) {
        User user = requireUser(email);
        if (PosAccess.isPos()) {
            PosAccess.requireBoundStore(storeId);
        } else {
            requireStockEditor(storeId, user.getId());
        }
        BrewStore store = requireStore(storeId);
        List<BrewStoreStockCategory> categories =
                stockCategoryRepository.findByStoreIdOrderByCategoryNameAsc(storeId);
        if (categories.isEmpty()) {
            return List.of();
        }
        List<BrewStoreStock> stocks = stockRepository.findByCategoryIdInOrderByStockNameAsc(
                categories.stream().map(BrewStoreStockCategory::getId).toList());
        Map<Integer, List<BrewStoreStock>> stocksByCategory = stocks.stream()
                .collect(Collectors.groupingBy(
                        BrewStoreStock::getCategoryId,
                        LinkedHashMap::new,
                        Collectors.toList()));
        Map<Integer, List<BrewStoreStockUsageDay>> usageByStock =
                loadUsageByStock(store.isStockUsageHint(), stocks);
        boolean includeOrderUrl = isOwner(store, user.getId()) && !PosAccess.isPos();
        List<StockCategoryResponse> result = new ArrayList<>(categories.size());
        for (BrewStoreStockCategory category : categories) {
            List<StockResponse> responses = stocksByCategory
                    .getOrDefault(category.getId(), List.of())
                    .stream()
                    .map(stock -> toStockResponse(
                            store.isStockUsageHint(), stock, usageByStock, includeOrderUrl))
                    .toList();
            result.add(StockCategoryResponse.from(category, responses));
        }
        return result;
    }

    @Transactional
    public StockCategoryResponse createStockCategory(
            String email,
            UUID storeId,
            NameRequest request
    ) {
        User user = requireUser(email);
        requireStockMutator(storeId, user.getId(), null);
        String name = request.name().trim();
        if (stockCategoryRepository.existsByStoreIdAndCategoryName(storeId, name)) {
            throw new BusinessException(HttpStatus.CONFLICT, "CATEGORY_NAME_TAKEN", "이미 있는 카테고리 이름입니다.");
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
        requireStockMutator(category.getStoreId(), user.getId(), null);
        String name = request.name().trim();
        if (name.isEmpty()) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "CATEGORY_NAME_REQUIRED", "카테고리 이름을 입력해 주세요.");
        }
        if (!category.getCategoryName().equalsIgnoreCase(name)
                && stockCategoryRepository.existsByStoreIdAndCategoryName(
                        category.getStoreId(),
                        name
                )) {
            throw new BusinessException(HttpStatus.CONFLICT, "CATEGORY_NAME_TAKEN", "이미 있는 카테고리 이름입니다.");
        }
        category.rename(name);
        List<BrewStoreStock> stocks =
                stockRepository.findByCategoryIdOrderByStockNameAsc(categoryId);
        BrewStore store = requireStore(category.getStoreId());
        Map<Integer, List<BrewStoreStockUsageDay>> usageByStock =
                loadUsageByStock(store.isStockUsageHint(), stocks);
        boolean includeOrderUrl = isOwner(store, user.getId());
        return StockCategoryResponse.from(
                category,
                stocks.stream()
                        .map(stock -> toStockResponse(
                                store.isStockUsageHint(), stock, usageByStock, includeOrderUrl))
                        .toList());
    }

    @Transactional
    public void deleteStockCategory(String email, Integer categoryId) {
        User user = requireUser(email);
        BrewStoreStockCategory category = requireStockCategory(categoryId);
        requireStockMutator(category.getStoreId(), user.getId(), null);
        stockCategoryRepository.delete(category);
    }

    @Transactional
    public StockResponse createStock(String email, Integer categoryId, StockRequest request) {
        User user = requireUser(email);
        BrewStoreStockCategory category = requireStockCategory(categoryId);
        requireStockMutator(category.getStoreId(), user.getId(), null);
        BrewStore store = requireStore(category.getStoreId());
        boolean includeOrderUrl = isOwner(store, user.getId());
        validateStockNums(request.stockNum(), request.stockMinNum());
        String name = request.stockName().trim();
        if (stockRepository.existsByCategoryIdAndStockName(categoryId, name)) {
            throw new BusinessException(HttpStatus.CONFLICT, "STOCK_NAME_TAKEN", "이미 있는 재고 이름입니다.");
        }
        BrewStoreStock stock = stockRepository.save(BrewStoreStock.builder()
                .categoryId(categoryId)
                .stockName(name)
                .stockNum(request.stockNum())
                .stockMinNum(request.stockMinNum())
                .unit(resolveUnit(request.unit()))
                .orderUrl(includeOrderUrl
                        ? resolveOrderUrl(request.orderUrl() == null ? "" : request.orderUrl())
                        : null)
                .build());
        recordQtyLog(stock.getId(), user.getId(), 0, stock.getStockNum());
        return StockResponse.from(stock, false, null, includeOrderUrl);
    }

    @Transactional
    public StockResponse updateStock(String email, Integer stockId, StockRequest request) {
        User user = requireUser(email);
        BrewStoreStock stock = requireStock(stockId);
        BrewStoreStockCategory category = requireStockCategory(stock.getCategoryId());
        requireStockMutator(category.getStoreId(), user.getId(), stockId);
        BrewStore store = requireStore(category.getStoreId());
        boolean includeOrderUrl = isOwner(store, user.getId());
        boolean posQtyOnly = PosAccess.isPos() && !PosAccess.require().canEditStock();
        if (posQtyOnly) {
            validateStockNums(request.stockNum(), stock.getStockMinNum());
        } else {
            validateStockNums(request.stockNum(), request.stockMinNum());
        }
        if (request.version() == null) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "STOCK_VERSION_REQUIRED", "재고 version이 필요합니다.");
        }
        int currentVersion = stock.getVersion() == null ? 0 : stock.getVersion();
        if (currentVersion != request.version()) {
            throw new BusinessException(
                    HttpStatus.CONFLICT,
                    "STOCK_STALE",
                    "다른 사용자가 재고를 수정했습니다. 다시 불러온 뒤 수정하세요."
            );
        }
        Integer targetCategoryId =
                posQtyOnly || request.categoryId() == null
                        ? stock.getCategoryId()
                        : request.categoryId();
        BrewStoreStockCategory targetCategory = requireStockCategory(targetCategoryId);
        if (!targetCategory.getStoreId().equals(category.getStoreId())) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "STOCK_CATEGORY_WRONG_STORE", "다른 가게 카테고리로는 옮길 수 없습니다.");
        }
        String name = posQtyOnly ? stock.getStockName() : request.stockName().trim();
        if (!posQtyOnly && stockRepository.existsByCategoryIdAndStockNameAndIdNot(
                targetCategoryId,
                name,
                stockId
        )) {
            throw new BusinessException(HttpStatus.CONFLICT, "STOCK_NAME_TAKEN", "이미 있는 재고 이름입니다.");
        }
        int previousNum = stock.getStockNum();
        String unit = posQtyOnly || request.unit() == null
                ? stock.getUnit()
                : resolveUnit(request.unit());
        String orderUrl = includeOrderUrl
                ? (request.orderUrl() == null
                        ? stock.getOrderUrl()
                        : resolveOrderUrl(request.orderUrl()))
                : stock.getOrderUrl();
        stock.update(
                targetCategoryId,
                name,
                request.stockNum(),
                posQtyOnly ? stock.getStockMinNum() : request.stockMinNum(),
                unit,
                posQtyOnly ? stock.getOrderUrl() : orderUrl);
        BrewStoreStock saved = stockRepository.save(stock);
        stockRepository.flush();
        recordQtyLog(saved.getId(), user.getId(), previousNum, saved.getStockNum());
        if (store.isStockUsageHint()) {
            applyUsageDelta(saved.getId(), previousNum, saved.getStockNum());
        }
        if (stockCheckService.isRequested(store.getId(), saved.getId())) {
            stockCheckService.publishOpen(store.getId());
        }
        return toStockResponse(store.isStockUsageHint(), saved, includeOrderUrl);
    }

    @Transactional(readOnly = true)
    public List<StockLogResponse> listStockLogs(UUID storeId, Integer stockId, String email) {
        User user = requireUser(email);
        if (PosAccess.isPos()) {
            PosAccess.requireBoundStore(storeId);
        } else {
            requireStockEditor(storeId, user.getId());
        }
        BrewStoreStock stock = requireStock(stockId);
        BrewStoreStockCategory category = requireStockCategory(stock.getCategoryId());
        if (!category.getStoreId().equals(storeId)) {
            throw new BusinessException(HttpStatus.NOT_FOUND, "STOCK_NOT_FOUND", "재고를 찾을 수 없습니다.");
        }
        List<BrewStoreStockLog> logs = stockLogRepository.findTop50ByStockIdOrderByIdDesc(stockId);
        Map<UUID, String> nicknames = userService.nicknameMap(
                logs.stream().map(BrewStoreStockLog::getUserId).toList());
        return logs.stream()
                .map(log -> new StockLogResponse(
                        log.getId(),
                        log.getFromNum(),
                        log.getToNum(),
                        nicknames.getOrDefault(log.getUserId(), ""),
                        log.getCreatedAt()
                ))
                .toList();
    }

    @Transactional
    public void deleteStock(String email, Integer stockId) {
        User user = requireUser(email);
        BrewStoreStock stock = requireStock(stockId);
        BrewStoreStockCategory category = requireStockCategory(stock.getCategoryId());
        requireStockMutator(category.getStoreId(), user.getId(), null);
        stockRepository.delete(stock);
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
            throw new BusinessException(HttpStatus.FORBIDDEN, "STOCK_EDIT_FORBIDDEN", "재고 수정 권한이 없습니다.");
        }
    }

    private void requireStockMutator(UUID storeId, UUID userId, Integer stockId) {
        if (PosAccess.isPos()) {
            PosAccess.requireBoundStore(storeId);
            if (PosAccess.require().canEditStock()) {
                return;
            }
            if (stockId != null && stockCheckService.isRequested(storeId, stockId)) {
                return;
            }
            throw new BusinessException(HttpStatus.FORBIDDEN, "STOCK_EDIT_FORBIDDEN", "재고 수정 권한이 없습니다.");
        }
        requireStockEditor(storeId, userId);
        BrewStore store = requireStore(storeId);
        if (store.getOwnerUserId().equals(userId)) {
            return;
        }
        if (store.isStockEditOffDuty()) {
            return;
        }
        if (!brewScheduleService.isCurrentlyOnDuty(storeId, userId)) {
            throw new BusinessException(
                    HttpStatus.FORBIDDEN,
                    "STOCK_EDIT_OFF_DUTY",
                    "근무 시간에만 재고를 수정할 수 있습니다."
            );
        }
    }

    private User requireUser(String email) {
        return userService.findByEmail(email.trim().toLowerCase())
                .orElseThrow(() ->
                        new BusinessException(HttpStatus.UNAUTHORIZED, "LOGIN_REQUIRED", "로그인이 필요합니다."));
    }

    private BrewStore requireStore(UUID storeId) {
        return storeRepository.findById(storeId)
                .orElseThrow(() ->
                        new BusinessException(HttpStatus.NOT_FOUND, "STORE_NOT_FOUND", "가게를 찾을 수 없습니다."));
    }

    private BrewStoreStockCategory requireStockCategory(Integer categoryId) {
        return stockCategoryRepository.findById(categoryId)
                .orElseThrow(() -> new BusinessException(
                        HttpStatus.NOT_FOUND,
                        "STOCK_CATEGORY_NOT_FOUND",
                        "재고 카테고리를 찾을 수 없습니다."
                ));
    }

    private BrewStoreStock requireStock(Integer stockId) {
        return stockRepository.findById(stockId)
                .orElseThrow(() ->
                        new BusinessException(HttpStatus.NOT_FOUND, "STOCK_NOT_FOUND", "재고를 찾을 수 없습니다."));
    }

    private void validateStockNums(int stockNum, Integer stockMinNum) {
        if (stockNum < 0) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "STOCK_QTY_NEGATIVE", "재고 수량은 0 이상이어야 합니다.");
        }
        if (stockMinNum != null && stockMinNum < 0) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "STOCK_MIN_NEGATIVE", "경고 수량은 0 이상이어야 합니다.");
        }
    }

    private Map<Integer, List<BrewStoreStockUsageDay>> loadUsageByStock(
            boolean enabled,
            List<BrewStoreStock> stocks
    ) {
        if (!enabled || stocks.isEmpty()) {
            return Map.of();
        }
        List<Integer> ids = stocks.stream().map(BrewStoreStock::getId).toList();
        LocalDate from = BrewStockUsageForecast.windowStart(todaySeoul());
        return usageDayRepository.findByStockIdInAndUsedOnGreaterThanEqual(ids, from).stream()
                .collect(Collectors.groupingBy(BrewStoreStockUsageDay::getStockId));
    }

    private static boolean isOwner(BrewStore store, UUID userId) {
        return store.getOwnerUserId().equals(userId);
    }

    private StockResponse toStockResponse(
            boolean enabled,
            BrewStoreStock stock,
            boolean includeOrderUrl
    ) {
        if (!enabled) {
            return StockResponse.from(stock, false, null, includeOrderUrl);
        }
        LocalDate from = BrewStockUsageForecast.windowStart(todaySeoul());
        List<BrewStoreStockUsageDay> days =
                usageDayRepository.findByStockIdAndUsedOnGreaterThanEqual(stock.getId(), from);
        Forecast forecast = BrewStockUsageForecast.compute(stock, days);
        return StockResponse.from(stock, forecast.soonLow(), forecast.daysOfStock(), includeOrderUrl);
    }

    private StockResponse toStockResponse(
            boolean enabled,
            BrewStoreStock stock,
            Map<Integer, List<BrewStoreStockUsageDay>> usageByStock,
            boolean includeOrderUrl
    ) {
        if (!enabled) {
            return StockResponse.from(stock, false, null, includeOrderUrl);
        }
        Forecast forecast = BrewStockUsageForecast.compute(
                stock,
                usageByStock.getOrDefault(stock.getId(), List.of()));
        return StockResponse.from(stock, forecast.soonLow(), forecast.daysOfStock(), includeOrderUrl);
    }

    private void applyUsageDelta(Integer stockId, int previousNum, int nextNum) {
        int decrease = previousNum - nextNum;
        if (decrease >= 1) {
            addUsage(stockId, decrease);
            return;
        }
        if (nextNum - previousNum == 1) {
            subtractUsage(stockId, 1);
        }
    }

    private void addUsage(Integer stockId, int qty) {
        LocalDate today = todaySeoul();
        usageDayRepository.findByStockIdAndUsedOn(stockId, today)
                .ifPresentOrElse(
                        row -> row.add(qty),
                        () -> usageDayRepository.save(new BrewStoreStockUsageDay(stockId, today, qty)));
    }

    private void subtractUsage(Integer stockId, int qty) {
        LocalDate today = todaySeoul();
        usageDayRepository.findByStockIdAndUsedOn(stockId, today).ifPresent(row -> {
            row.subtract(qty);
            if (row.getQty() <= 0) {
                usageDayRepository.delete(row);
            }
        });
    }

    private void recordQtyLog(Integer stockId, UUID userId, int fromNum, int toNum) {
        if (fromNum == toNum) {
            return;
        }
        stockLogRepository.save(new BrewStoreStockLog(stockId, userId, fromNum, toNum));
    }

    private static String resolveUnit(String raw) {
        String unit = raw == null ? "" : raw.trim();
        if (unit.isEmpty()) {
            return "개";
        }
        if (unit.length() > UNIT_MAX_LEN) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "UNIT_TOO_LONG", "단위는 16자까지 입력할 수 있습니다.");
        }
        return unit;
    }

    private static String resolveOrderUrl(String raw) {
        if (raw == null) {
            return null;
        }
        String url = raw.trim();
        if (url.isEmpty()) {
            return null;
        }
        String lower = url.toLowerCase(Locale.ROOT);
        if (!lower.startsWith("http://") && !lower.startsWith("https://")) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "ORDER_URL_INVALID", "http 또는 https 주소만 넣을 수 있습니다.");
        }
        return url;
    }

    private static LocalDate todaySeoul() {
        return BrewShiftTimes.nowSeoul().toLocalDate();
    }
}
