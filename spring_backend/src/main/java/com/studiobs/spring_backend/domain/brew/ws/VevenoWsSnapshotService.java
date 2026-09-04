package com.studiobs.spring_backend.domain.brew.ws;

import com.studiobs.spring_backend.domain.brew.dto.NoticeResponse;
import com.studiobs.spring_backend.domain.brew.dto.StockCheckResponse;
import com.studiobs.spring_backend.domain.brew.dto.VevenoWsStoreSnapshot;
import com.studiobs.spring_backend.domain.brew.entity.BrewStore;
import com.studiobs.spring_backend.domain.brew.entity.BrewStoreSubscription;
import com.studiobs.spring_backend.domain.brew.repository.BrewStoreRepository;
import com.studiobs.spring_backend.domain.brew.repository.BrewStoreSubscriptionRepository;
import com.studiobs.spring_backend.domain.brew.service.BrewNoticeService;
import com.studiobs.spring_backend.domain.brew.service.VevenoStockCheckService;
import com.studiobs.spring_backend.domain.brew.support.PosAccess;
import com.studiobs.spring_backend.domain.user.entity.User;
import com.studiobs.spring_backend.domain.user.service.UserService;
import com.studiobs.spring_backend.global.exception.BusinessException;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class VevenoWsSnapshotService {

    public record Scope(Set<UUID> stockCheckStores, Set<UUID> noticeStores) {
    }

    public record Result(Scope scope, List<VevenoWsStoreSnapshot> stores) {
    }

    private final UserService userService;
    private final BrewStoreRepository storeRepository;
    private final BrewStoreSubscriptionRepository subscriptionRepository;
    private final VevenoStockCheckService stockCheckService;
    private final BrewNoticeService brewNoticeService;

    @Transactional(readOnly = true)
    public Result snapshot(String email) {
        if (PosAccess.isPos()) {
            UUID storeId = PosAccess.require().storeId();
            BrewStore store = storeRepository.findById(storeId)
                    .orElseThrow(() -> new BusinessException(
                            HttpStatus.NOT_FOUND, "STORE_NOT_FOUND", "가게를 찾을 수 없습니다."));
            Set<UUID> one = Set.of(storeId);
            Map<UUID, List<NoticeResponse>> notices = brewNoticeService.listByStoreIds(one);
            return new Result(
                    new Scope(one, one),
                    List.of(new VevenoWsStoreSnapshot(
                            store.getId(),
                            store.getName(),
                            stockCheckService.openOf(storeId),
                            null,
                            notices.getOrDefault(storeId, List.of()))));
        }
        User user = userService.findByEmail(email.trim().toLowerCase())
                .orElseThrow(() -> new BusinessException(
                        HttpStatus.UNAUTHORIZED, "LOGIN_REQUIRED", "로그인이 필요합니다."));
        List<BrewStore> owned = storeRepository.findByOwnerUserIdOrderByUpdatedAtDesc(user.getId());
        LinkedHashSet<UUID> stockCheck = new LinkedHashSet<>();
        LinkedHashSet<UUID> notice = new LinkedHashSet<>();
        List<BrewStore> ordered = new ArrayList<>(owned);
        for (BrewStore store : owned) {
            stockCheck.add(store.getId());
            notice.add(store.getId());
        }
        for (BrewStoreSubscription sub :
                subscriptionRepository.findBySubscriberUserIdOrderByCreatedAtDesc(user.getId())) {
            if (notice.add(sub.getStoreId())) {
                storeRepository.findById(sub.getStoreId()).ifPresent(ordered::add);
            }
        }
        Map<UUID, List<NoticeResponse>> notices = brewNoticeService.listByStoreIds(notice);
        List<VevenoWsStoreSnapshot> stores = new ArrayList<>();
        for (BrewStore store : ordered) {
            UUID storeId = store.getId();
            StockCheckResponse open = stockCheck.contains(storeId) ? stockCheckService.openOf(storeId) : null;
            StockCheckResponse done = stockCheck.contains(storeId) ? stockCheckService.doneOf(storeId) : null;
            stores.add(new VevenoWsStoreSnapshot(
                    storeId,
                    store.getName(),
                    open,
                    done,
                    notices.getOrDefault(storeId, List.of())));
        }
        return new Result(new Scope(Set.copyOf(stockCheck), Set.copyOf(notice)), stores);
    }
}
