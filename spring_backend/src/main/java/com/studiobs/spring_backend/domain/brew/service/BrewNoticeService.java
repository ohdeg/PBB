package com.studiobs.spring_backend.domain.brew.service;

import com.studiobs.spring_backend.domain.brew.dto.NoticeRequest;
import com.studiobs.spring_backend.domain.brew.dto.NoticeResponse;
import com.studiobs.spring_backend.domain.brew.entity.BrewStore;
import com.studiobs.spring_backend.domain.brew.entity.BrewStoreNotice;
import com.studiobs.spring_backend.domain.brew.repository.BrewStoreNoticeRepository;
import com.studiobs.spring_backend.domain.brew.repository.BrewStoreRepository;
import com.studiobs.spring_backend.domain.brew.repository.BrewStoreSubscriptionRepository;
import com.studiobs.spring_backend.domain.user.entity.User;
import com.studiobs.spring_backend.domain.user.service.UserService;
import com.studiobs.spring_backend.global.exception.BusinessException;
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
        return NoticeResponse.from(
                noticeRepository.save(notice),
                nicknameOf(notice.getAuthorUserId())
        );
    }

    @Transactional
    public void deleteNotice(String email, UUID noticeId) {
        User user = requireUser(email);
        BrewStoreNotice notice = requireNotice(noticeId);
        requireOwnedStore(notice.getStoreId(), user.getId());
        noticeRepository.delete(notice);
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

    private BrewStore requireOwnedStore(UUID storeId, UUID ownerId) {
        BrewStore store = requireStore(storeId);
        if (!store.getOwnerUserId().equals(ownerId)) {
            throw new BusinessException(HttpStatus.FORBIDDEN, "가게 소유자만 관리할 수 있습니다.");
        }
        return store;
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

    private BrewStoreNotice requireNotice(UUID noticeId) {
        return noticeRepository.findById(noticeId)
                .orElseThrow(() ->
                        new BusinessException(HttpStatus.NOT_FOUND, "공지를 찾을 수 없습니다."));
    }

    private String nicknameOf(UUID userId) {
        return userService.findById(userId).map(User::getNickname).orElse("");
    }
}
