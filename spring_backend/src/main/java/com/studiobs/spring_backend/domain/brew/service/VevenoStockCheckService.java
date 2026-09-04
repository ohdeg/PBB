package com.studiobs.spring_backend.domain.brew.service;

import com.studiobs.spring_backend.domain.brew.dto.StockCheckItemResponse;
import com.studiobs.spring_backend.domain.brew.dto.StockCheckRecord;
import com.studiobs.spring_backend.domain.brew.dto.StockCheckResponse;
import com.studiobs.spring_backend.domain.brew.dto.VevenoWsEvent;
import com.studiobs.spring_backend.domain.brew.entity.BrewStore;
import com.studiobs.spring_backend.domain.brew.entity.BrewStoreStock;
import com.studiobs.spring_backend.domain.brew.entity.BrewStoreStockCategory;
import com.studiobs.spring_backend.domain.brew.repository.BrewStoreRepository;
import com.studiobs.spring_backend.domain.brew.repository.BrewStoreStockCategoryRepository;
import com.studiobs.spring_backend.domain.brew.repository.BrewStoreStockRepository;
import com.studiobs.spring_backend.domain.brew.support.PosAccess;
import com.studiobs.spring_backend.domain.user.entity.User;
import com.studiobs.spring_backend.domain.user.service.UserService;
import com.studiobs.spring_backend.global.exception.BusinessException;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.ObjectMapper;

@Service
@RequiredArgsConstructor
public class VevenoStockCheckService {

    static final Duration TTL = Duration.ofHours(2);
    static final String OPEN_PREFIX = "veveno:stock-check:";
    static final String DONE_PREFIX = "veveno:stock-check-done:";

    private final UserService userService;
    private final BrewStoreRepository storeRepository;
    private final BrewStoreStockRepository stockRepository;
    private final BrewStoreStockCategoryRepository stockCategoryRepository;
    private final org.springframework.data.redis.core.StringRedisTemplate stringRedisTemplate;
    private final ObjectMapper objectMapper;
    private final com.studiobs.spring_backend.domain.brew.ws.VevenoWsPublisher wsPublisher;

    @Transactional(readOnly = true)
    public StockCheckResponse upsert(String email, UUID storeId, List<Integer> stockIds) {
        User user = requireUser(email);
        BrewStore store = requireOwnerStore(storeId, user.getId());
        List<Integer> add = uniqueIds(stockIds);
        requireStocksInStore(storeId, add);
        Instant now = Instant.now();
        StockCheckRecord existing = read(openKey(storeId));
        StockCheckRecord next;
        if (existing == null) {
            LinkedHashSet<Integer> ids = new LinkedHashSet<>(add);
            next = new StockCheckRecord(
                    UUID.randomUUID().toString(),
                    List.copyOf(ids),
                    now,
                    now,
                    user.getId().toString());
        } else {
            LinkedHashSet<Integer> ids = new LinkedHashSet<>(existing.stockIds());
            ids.addAll(add);
            next = new StockCheckRecord(
                    existing.requestId(),
                    List.copyOf(ids),
                    existing.requestedAt(),
                    now,
                    existing.requestedByUserId());
        }
        write(openKey(storeId), next);
        StockCheckResponse body = toResponse(next);
        publish(storeId, store.getName(), "open", body, doneOf(storeId));
        return body;
    }

    @Transactional(readOnly = true)
    public StockCheckResponse remove(String email, UUID storeId, List<Integer> removeStockIds) {
        User user = requireUser(email);
        BrewStore store = requireOwnerStore(storeId, user.getId());
        StockCheckRecord existing = read(openKey(storeId));
        if (existing == null) {
            return null;
        }
        Set<Integer> drop = Set.copyOf(uniqueIds(removeStockIds));
        List<Integer> kept = existing.stockIds().stream().filter(id -> !drop.contains(id)).toList();
        if (kept.isEmpty()) {
            stringRedisTemplate.delete(openKey(storeId));
            publish(storeId, store.getName(), "cleared", null, doneOf(storeId));
            return null;
        }
        StockCheckRecord next = new StockCheckRecord(
                existing.requestId(),
                kept,
                existing.requestedAt(),
                Instant.now(),
                existing.requestedByUserId());
        write(openKey(storeId), next);
        StockCheckResponse body = toResponse(next);
        publish(storeId, store.getName(), "open", body, doneOf(storeId));
        return body;
    }

    public void cancel(String email, UUID storeId) {
        User user = requireUser(email);
        BrewStore store = requireOwnerStore(storeId, user.getId());
        stringRedisTemplate.delete(openKey(storeId));
        publish(storeId, store.getName(), "cleared", null, doneOf(storeId));
    }

    @Transactional(readOnly = true)
    public StockCheckResponse current(String email, UUID storeId) {
        requireViewer(email, storeId);
        StockCheckRecord record = read(openKey(storeId));
        return record == null ? null : toResponse(record);
    }

    @Transactional(readOnly = true)
    public void complete(String email, UUID storeId) {
        requirePos(storeId);
        requireUser(email);
        StockCheckRecord open = read(openKey(storeId));
        if (open == null) {
            return;
        }
        Instant now = Instant.now();
        StockCheckRecord doneRecord = new StockCheckRecord(
                open.requestId(),
                open.stockIds(),
                open.requestedAt(),
                now,
                open.requestedByUserId());
        write(doneKey(storeId), doneRecord);
        stringRedisTemplate.delete(openKey(storeId));
        BrewStore store = storeRepository.findById(storeId).orElse(null);
        String name = store == null ? "" : store.getName();
        publish(storeId, name, "done", null, toResponse(doneRecord));
    }

    @Transactional(readOnly = true)
    public StockCheckResponse done(String email, UUID storeId) {
        User user = requireUser(email);
        requireOwnerStore(storeId, user.getId());
        StockCheckRecord record = read(doneKey(storeId));
        return record == null ? null : toResponse(record);
    }

    public void ackDone(String email, UUID storeId) {
        User user = requireUser(email);
        BrewStore store = requireOwnerStore(storeId, user.getId());
        stringRedisTemplate.delete(doneKey(storeId));
        publish(storeId, store.getName(), "cleared", openOf(storeId), null);
    }

    public boolean isRequested(UUID storeId, Integer stockId) {
        StockCheckRecord record = read(openKey(storeId));
        return record != null && record.stockIds().contains(stockId);
    }

    public StockCheckResponse openOf(UUID storeId) {
        StockCheckRecord record = read(openKey(storeId));
        return record == null ? null : toResponse(record);
    }

    public StockCheckResponse doneOf(UUID storeId) {
        StockCheckRecord record = read(doneKey(storeId));
        return record == null ? null : toResponse(record);
    }

    public void publishOpen(UUID storeId) {
        BrewStore store = storeRepository.findById(storeId).orElse(null);
        if (store == null) {
            return;
        }
        StockCheckResponse open = openOf(storeId);
        if (open == null) {
            return;
        }
        publish(storeId, store.getName(), "open", open, doneOf(storeId));
    }

    private void publish(
            UUID storeId,
            String storeName,
            String kind,
            StockCheckResponse open,
            StockCheckResponse done
    ) {
        wsPublisher.publish(VevenoWsEvent.stockCheck(kind, storeId, storeName, open, done));
    }

    private StockCheckResponse toResponse(StockCheckRecord record) {
        Map<Integer, BrewStoreStock> byId = stockRepository.findAllById(record.stockIds()).stream()
                .collect(Collectors.toMap(BrewStoreStock::getId, Function.identity()));
        List<StockCheckItemResponse> items = new ArrayList<>();
        for (Integer id : record.stockIds()) {
            BrewStoreStock stock = byId.get(id);
            if (stock == null) {
                continue;
            }
            items.add(new StockCheckItemResponse(
                    stock.getId(),
                    stock.getCategoryId(),
                    stock.getStockName(),
                    stock.getStockNum(),
                    stock.getStockMinNum(),
                    stock.getUnit() == null || stock.getUnit().isBlank() ? "개" : stock.getUnit(),
                    stock.getVersion() == null ? 0 : stock.getVersion()));
        }
        return new StockCheckResponse(record.requestId(), record.updatedAt(), items);
    }

    private void requireStocksInStore(UUID storeId, List<Integer> stockIds) {
        List<BrewStoreStock> stocks = stockRepository.findAllById(stockIds);
        if (stocks.size() != stockIds.size()) {
            throw new BusinessException(HttpStatus.NOT_FOUND, "STOCK_NOT_FOUND", "재고를 찾을 수 없습니다.");
        }
        for (BrewStoreStock stock : stocks) {
            BrewStoreStockCategory category = stockCategoryRepository.findById(stock.getCategoryId())
                    .orElseThrow(() -> new BusinessException(
                            HttpStatus.NOT_FOUND, "STOCK_CATEGORY_NOT_FOUND", "재고 카테고리를 찾을 수 없습니다."));
            if (!category.getStoreId().equals(storeId)) {
                throw new BusinessException(
                        HttpStatus.BAD_REQUEST, "STOCK_WRONG_STORE", "이 가게 재고가 아닙니다.");
            }
        }
    }

    private static List<Integer> uniqueIds(List<Integer> stockIds) {
        LinkedHashSet<Integer> ids = new LinkedHashSet<>();
        for (Integer id : stockIds) {
            if (id != null) {
                ids.add(id);
            }
        }
        if (ids.isEmpty()) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "STOCK_CHECK_EMPTY", "재고를 골라 주세요.");
        }
        return List.copyOf(ids);
    }

    private void requireViewer(String email, UUID storeId) {
        if (PosAccess.isPos()) {
            PosAccess.requireBoundStore(storeId);
            return;
        }
        User user = requireUser(email);
        requireOwnerStore(storeId, user.getId());
    }

    private void requirePos(UUID storeId) {
        if (!PosAccess.isPos()) {
            throw new BusinessException(HttpStatus.FORBIDDEN, "POS_ONLY", "POS에서만 완료할 수 있습니다.");
        }
        PosAccess.requireBoundStore(storeId);
    }

    private BrewStore requireOwnerStore(UUID storeId, UUID userId) {
        PosAccess.forbidManagement();
        BrewStore store = storeRepository.findById(storeId)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "STORE_NOT_FOUND", "가게를 찾을 수 없습니다."));
        if (!store.getOwnerUserId().equals(userId)) {
            throw new BusinessException(HttpStatus.FORBIDDEN, "OWNER_ONLY", "가게 소유자만 관리할 수 있습니다.");
        }
        return store;
    }

    private User requireUser(String email) {
        return userService.findByEmail(email.trim().toLowerCase())
                .orElseThrow(() ->
                        new BusinessException(HttpStatus.UNAUTHORIZED, "LOGIN_REQUIRED", "로그인이 필요합니다."));
    }

    private void write(String key, StockCheckRecord value) {
        try {
            stringRedisTemplate.opsForValue().set(key, objectMapper.writeValueAsString(value), TTL);
        } catch (JacksonException ex) {
            throw new BusinessException(HttpStatus.INTERNAL_SERVER_ERROR, "STOCK_CHECK_REDIS", "재고 확인을 저장할 수 없습니다.");
        }
    }

    private StockCheckRecord read(String key) {
        String raw = stringRedisTemplate.opsForValue().get(key);
        if (raw == null || raw.isBlank()) {
            return null;
        }
        try {
            return objectMapper.readValue(raw, StockCheckRecord.class);
        } catch (JacksonException ex) {
            return null;
        }
    }

    static String openKey(UUID storeId) {
        return OPEN_PREFIX + storeId;
    }

    static String doneKey(UUID storeId) {
        return DONE_PREFIX + storeId;
    }
}
