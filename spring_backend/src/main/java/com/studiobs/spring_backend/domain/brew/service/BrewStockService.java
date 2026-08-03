package com.studiobs.spring_backend.domain.brew.service;

import com.studiobs.spring_backend.domain.brew.dto.NameRequest;
import com.studiobs.spring_backend.domain.brew.dto.StockCategoryResponse;
import com.studiobs.spring_backend.domain.brew.dto.StockRequest;
import com.studiobs.spring_backend.domain.brew.dto.StockResponse;
import com.studiobs.spring_backend.domain.brew.entity.BrewStore;
import com.studiobs.spring_backend.domain.brew.entity.BrewStoreStock;
import com.studiobs.spring_backend.domain.brew.entity.BrewStoreStockCategory;
import com.studiobs.spring_backend.domain.brew.entity.BrewStoreSubscription;
import com.studiobs.spring_backend.domain.brew.repository.BrewStoreRepository;
import com.studiobs.spring_backend.domain.brew.repository.BrewStoreStockCategoryRepository;
import com.studiobs.spring_backend.domain.brew.repository.BrewStoreStockRepository;
import com.studiobs.spring_backend.domain.brew.repository.BrewStoreSubscriptionRepository;
import com.studiobs.spring_backend.domain.user.entity.User;
import com.studiobs.spring_backend.domain.user.service.UserService;
import com.studiobs.spring_backend.global.exception.BusinessException;
import java.util.List;
import java.util.UUID;
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
    private final BrewScheduleService brewScheduleService;

    @Transactional(readOnly = true)
    public List<StockCategoryResponse> listStockCategories(UUID storeId, String email) {
        User user = requireUser(email);
        requireStockEditor(storeId, user.getId());
        return stockCategoryRepository.findByStoreIdOrderByCategoryNameAsc(storeId).stream()
                .map(category -> StockCategoryResponse.from(
                        category,
                        stockRepository.findByCategoryIdOrderByStockNameAsc(category.getId())))
                .toList();
    }

    @Transactional
    public StockCategoryResponse createStockCategory(
            String email,
            UUID storeId,
            NameRequest request
    ) {
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
                && stockCategoryRepository.existsByStoreIdAndCategoryName(
                        category.getStoreId(),
                        name
                )) {
            throw new BusinessException(HttpStatus.CONFLICT, "이미 있는 카테고리 이름입니다.");
        }
        category.rename(name);
        List<BrewStoreStock> stocks =
                stockRepository.findByCategoryIdOrderByStockNameAsc(categoryId);
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
        if (request.version() == null) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "재고 version이 필요합니다.");
        }
        int currentVersion = stock.getVersion() == null ? 0 : stock.getVersion();
        if (currentVersion != request.version()) {
            throw new BusinessException(
                    HttpStatus.CONFLICT,
                    "다른 사용자가 재고를 수정했습니다. 다시 불러온 뒤 수정하세요."
            );
        }
        stock.update(request.stockName().trim(), request.stockNum(), request.stockMinNum());
        BrewStoreStock saved = stockRepository.save(stock);
        stockRepository.flush();
        return StockResponse.from(saved);
    }

    @Transactional
    public void deleteStock(String email, Integer stockId) {
        User user = requireUser(email);
        BrewStoreStock stock = requireStock(stockId);
        BrewStoreStockCategory category = requireStockCategory(stock.getCategoryId());
        requireStockMutator(category.getStoreId(), user.getId());
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

    private User requireUser(String email) {
        return userService.findByEmail(email.trim().toLowerCase())
                .orElseThrow(() ->
                        new BusinessException(HttpStatus.UNAUTHORIZED, "로그인이 필요합니다."));
    }

    private BrewStore requireStore(UUID storeId) {
        return storeRepository.findById(storeId)
                .orElseThrow(() ->
                        new BusinessException(HttpStatus.NOT_FOUND, "가게를 찾을 수 없습니다."));
    }

    private BrewStoreStockCategory requireStockCategory(Integer categoryId) {
        return stockCategoryRepository.findById(categoryId)
                .orElseThrow(() -> new BusinessException(
                        HttpStatus.NOT_FOUND,
                        "재고 카테고리를 찾을 수 없습니다."
                ));
    }

    private BrewStoreStock requireStock(Integer stockId) {
        return stockRepository.findById(stockId)
                .orElseThrow(() ->
                        new BusinessException(HttpStatus.NOT_FOUND, "재고를 찾을 수 없습니다."));
    }

    private void validateStockNums(int stockNum, Integer stockMinNum) {
        if (stockNum < 0) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "재고 수량은 0 이상이어야 합니다.");
        }
        if (stockMinNum != null && stockMinNum < 0) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "경고 수량은 0 이상이어야 합니다.");
        }
    }
}
