package com.studiobs.spring_backend.domain.brew.service;

import com.studiobs.spring_backend.domain.brew.dto.NoticeRequest;
import com.studiobs.spring_backend.domain.brew.dto.NoticeResponse;
import com.studiobs.spring_backend.domain.brew.dto.VevenoWsEvent;
import com.studiobs.spring_backend.domain.brew.entity.BrewStore;
import com.studiobs.spring_backend.domain.brew.entity.BrewStoreNotice;
import com.studiobs.spring_backend.domain.brew.repository.BrewStoreNoticeRepository;
import com.studiobs.spring_backend.domain.brew.repository.BrewStoreRepository;
import com.studiobs.spring_backend.domain.brew.repository.BrewStoreSubscriptionRepository;
import com.studiobs.spring_backend.domain.brew.support.PosAccess;
import com.studiobs.spring_backend.domain.user.entity.User;
import com.studiobs.spring_backend.domain.user.service.UserService;
import com.studiobs.spring_backend.global.exception.BusinessException;
import java.util.ArrayList;
import java.util.Collection;
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
public class BrewNoticeService {

    private final UserService userService;
    private final BrewStoreRepository storeRepository;
    private final BrewStoreSubscriptionRepository subscriptionRepository;
    private final BrewStoreNoticeRepository noticeRepository;
    private final com.studiobs.spring_backend.domain.brew.ws.VevenoWsPublisher wsPublisher;

    @Transactional(readOnly = true)
    public List<NoticeResponse> listNotices(String email, UUID storeId) {
        User user = requireUser(email);
        BrewStore store = requireStore(storeId);
        assertMember(store, user.getId());
        List<BrewStoreNotice> notices =
                noticeRepository.findByStoreIdOrderByCreatedAtDesc(storeId);
        if (notices.isEmpty()) {
            return List.of();
        }
        Map<UUID, String> nicknames = userService.nicknameMap(
                notices.stream().map(BrewStoreNotice::getAuthorUserId).toList());
        return notices.stream()
                .map(notice -> NoticeResponse.from(
                        notice,
                        nicknames.getOrDefault(notice.getAuthorUserId(), "")))
                .toList();
    }

    @Transactional(readOnly = true)
    public Map<UUID, List<NoticeResponse>> listByStoreIds(Collection<UUID> storeIds) {
        if (storeIds.isEmpty()) {
            return Map.of();
        }
        List<BrewStoreNotice> notices = noticeRepository.findByStoreIdInOrderByCreatedAtDesc(storeIds);
        if (notices.isEmpty()) {
            return Map.of();
        }
        Map<UUID, String> nicknames = userService.nicknameMap(
                notices.stream().map(BrewStoreNotice::getAuthorUserId).toList());
        Map<UUID, List<NoticeResponse>> byStore = new LinkedHashMap<>();
        for (BrewStoreNotice notice : notices) {
            byStore.computeIfAbsent(notice.getStoreId(), ignored -> new ArrayList<>())
                    .add(NoticeResponse.from(
                            notice,
                            nicknames.getOrDefault(notice.getAuthorUserId(), "")));
        }
        return byStore;
    }

    @Transactional
    public NoticeResponse createNotice(String email, UUID storeId, NoticeRequest request) {
        User user = requireUser(email);
        BrewStore store = requireOwnedStore(storeId, user.getId());
        BrewStoreNotice notice = noticeRepository.save(BrewStoreNotice.builder()
                .storeId(storeId)
                .authorUserId(user.getId())
                .title(request.title().trim())
                .body(request.body().trim())
                .build());
        NoticeResponse body = NoticeResponse.from(notice, user.getNickname());
        wsPublisher.publish(VevenoWsEvent.noticeCreated(store.getId(), store.getName(), body));
        return body;
    }

    @Transactional
    public NoticeResponse updateNotice(String email, UUID noticeId, NoticeRequest request) {
        User user = requireUser(email);
        BrewStoreNotice notice = requireNotice(noticeId);
        BrewStore store = requireOwnedStore(notice.getStoreId(), user.getId());
        notice.update(request.title().trim(), request.body().trim());
        NoticeResponse body = NoticeResponse.from(
                noticeRepository.save(notice),
                nicknameOf(notice.getAuthorUserId())
        );
        wsPublisher.publish(VevenoWsEvent.noticeUpdated(store.getId(), store.getName(), body));
        return body;
    }

    @Transactional
    public void deleteNotice(String email, UUID noticeId) {
        User user = requireUser(email);
        BrewStoreNotice notice = requireNotice(noticeId);
        BrewStore store = requireOwnedStore(notice.getStoreId(), user.getId());
        UUID id = notice.getId();
        noticeRepository.delete(notice);
        wsPublisher.publish(VevenoWsEvent.noticeDeleted(store.getId(), store.getName(), id));
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

    private BrewStore requireOwnedStore(UUID storeId, UUID ownerId) {
        PosAccess.forbidManagement();
        BrewStore store = requireStore(storeId);
        if (!store.getOwnerUserId().equals(ownerId)) {
            throw new BusinessException(HttpStatus.FORBIDDEN, "OWNER_ONLY", "가게 소유자만 관리할 수 있습니다.");
        }
        return store;
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

    private BrewStoreNotice requireNotice(UUID noticeId) {
        return noticeRepository.findById(noticeId)
                .orElseThrow(() ->
                        new BusinessException(HttpStatus.NOT_FOUND, "NOTICE_NOT_FOUND", "공지를 찾을 수 없습니다."));
    }

    private String nicknameOf(UUID userId) {
        return userService.findById(userId).map(User::getNickname).orElse("");
    }
}
