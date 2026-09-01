package com.studiobs.spring_backend.domain.brew.service;

import com.studiobs.spring_backend.domain.auth.jwt.JwtTokenProvider;
import com.studiobs.spring_backend.domain.auth.service.AuthRateLimitService;
import com.studiobs.spring_backend.domain.brew.dto.PosApproveRequest;
import com.studiobs.spring_backend.domain.brew.dto.PosCreateSessionResponse;
import com.studiobs.spring_backend.domain.brew.dto.PosDeviceResponse;
import com.studiobs.spring_backend.domain.brew.dto.PosMeResponse;
import com.studiobs.spring_backend.domain.brew.dto.PosPairSecret;
import com.studiobs.spring_backend.domain.brew.dto.PosPairState;
import com.studiobs.spring_backend.domain.brew.dto.PosPollResponse;
import com.studiobs.spring_backend.domain.brew.dto.PosSessionState;
import com.studiobs.spring_backend.domain.brew.dto.PosTokenResponse;
import com.studiobs.spring_backend.domain.brew.entity.BrewPosDevice;
import com.studiobs.spring_backend.domain.brew.entity.BrewStore;
import com.studiobs.spring_backend.domain.brew.entity.BrewStoreSubscription;
import com.studiobs.spring_backend.domain.brew.repository.BrewPosDeviceRepository;
import com.studiobs.spring_backend.domain.brew.repository.BrewStoreRepository;
import com.studiobs.spring_backend.domain.brew.repository.BrewStoreSubscriptionRepository;
import com.studiobs.spring_backend.domain.brew.support.PosAccess;
import com.studiobs.spring_backend.domain.user.entity.User;
import com.studiobs.spring_backend.domain.user.service.UserService;
import com.studiobs.spring_backend.global.exception.BusinessException;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class VevenoPosService {

    static final int MAX_DEVICES = 3;
    private static final String QR_PREFIX = "pbb-pos:v1:";

    private final UserService userService;
    private final BrewStoreRepository storeRepository;
    private final BrewStoreSubscriptionRepository subscriptionRepository;
    private final BrewPosDeviceRepository posDeviceRepository;
    private final VevenoPosRedisService posRedisService;
    private final JwtTokenProvider jwtTokenProvider;
    private final AuthRateLimitService authRateLimitService;
    private final BrewScheduleService brewScheduleService;
    private final SecureRandom secureRandom = new SecureRandom();

    public PosCreateSessionResponse createPair(String deviceId, String clientIp) {
        authRateLimitService.checkPosPair(clientIp);
        UUID pairId = UUID.randomUUID();
        String secret = randomSecret();
        UUID enrolledStoreId = posDeviceRepository.findFirstByDeviceId(deviceId)
                .map(BrewPosDevice::getStoreId)
                .orElse(null);
        posRedisService.savePair(pairId, new PosPairState(
                secret,
                deviceId,
                enrolledStoreId,
                PosPairState.PENDING,
                null,
                false));
        return new PosCreateSessionResponse(
                pairId,
                secret,
                QR_PREFIX + pairId + ":" + secret,
                Instant.now().plus(VevenoPosRedisService.PAIR_TTL),
                enrolledStoreId);
    }

    public PosPollResponse poll(List<PosPairSecret> pairs) {
        for (PosPairSecret pair : pairs) {
            PosPairState state = posRedisService.getPair(pair.pairId());
            if (state == null || !state.secret().equals(pair.secret())) {
                continue;
            }
            if (PosPairState.APPROVED.equals(state.status())) {
                return new PosPollResponse("ready", pair.pairId());
            }
        }
        return new PosPollResponse("pending", null);
    }

    @Transactional
    public void approve(String email, UUID pairId, PosApproveRequest request) {
        PosAccess.forbidManagement();
        User user = requireUser(email);
        PosPairState pair = posRedisService.getPair(pairId);
        if (pair == null || !pair.secret().equals(request.secret())) {
            throw qrChanged();
        }
        if (!PosPairState.PENDING.equals(pair.status())) {
            throw new BusinessException(HttpStatus.CONFLICT, "POS_PAIR_USED", "이미 처리된 QR입니다.");
        }
        BrewStore store = requireStore(request.storeId());
        boolean canEditStock;
        if (pair.storeId() == null) {
            if (!store.getOwnerUserId().equals(user.getId())) {
                throw new BusinessException(
                        HttpStatus.FORBIDDEN,
                        "POS_OWNER_ENROLL_ONLY",
                        "처음 등록은 사장님만 할 수 있습니다.");
            }
            enroll(store.getId(), pair.deviceId(), user.getId());
            canEditStock = true;
        } else {
            if (!pair.storeId().equals(request.storeId())) {
                throw new BusinessException(
                        HttpStatus.FORBIDDEN,
                        "POS_STORE_MISMATCH",
                        "이 POS에 연결된 가게가 아닙니다.");
            }
            canEditStock = resolveCanEditStock(store, user.getId());
        }
        posRedisService.savePair(pairId, new PosPairState(
                pair.secret(),
                pair.deviceId(),
                store.getId(),
                PosPairState.APPROVED,
                user.getId(),
                canEditStock));
    }

    public PosTokenResponse claim(UUID pairId, String secret) {
        PosPairState pair = posRedisService.takePair(pairId);
        if (pair == null || !pair.secret().equals(secret)) {
            throw qrChanged();
        }
        if (!PosPairState.APPROVED.equals(pair.status())
                || pair.userId() == null
                || pair.storeId() == null) {
            throw new BusinessException(HttpStatus.CONFLICT, "POS_PAIR_USED", "아직 승인되지 않은 QR입니다.");
        }
        User user = userService.findById(pair.userId())
                .orElseThrow(() -> new BusinessException(
                        HttpStatus.UNAUTHORIZED, "USER_NOT_FOUND", "회원을 찾을 수 없습니다."));
        if (!posDeviceRepository.existsByStoreIdAndDeviceId(pair.storeId(), pair.deviceId())) {
            throw new BusinessException(
                    HttpStatus.FORBIDDEN, "POS_DEVICE_REVOKED", "등록이 해제된 POS입니다.");
        }
        posRedisService.saveSession(new PosSessionState(
                user.getId(),
                pair.storeId(),
                pair.canEditStock(),
                pair.deviceId()));
        return issueToken(user, pair.storeId(), pair.canEditStock(), pair.deviceId());
    }

    public PosMeResponse me(String token) {
        PosAccess.Snapshot snapshot = PosAccess.require();
        return new PosMeResponse(
                snapshot.storeId(),
                snapshot.canEditStock(),
                jwtTokenProvider.getExpiry(token),
                snapshot.deviceId());
    }

    public PosTokenResponse extend(String email) {
        PosAccess.Snapshot snapshot = PosAccess.require();
        User user = requireUser(email);
        posRedisService.saveSession(new PosSessionState(
                snapshot.userId(),
                snapshot.storeId(),
                snapshot.canEditStock(),
                snapshot.deviceId()));
        return issueToken(user, snapshot.storeId(), snapshot.canEditStock(), snapshot.deviceId());
    }

    public void logout() {
        PosAccess.Snapshot snapshot = PosAccess.require();
        posRedisService.deleteSession(snapshot.deviceId());
    }

    @Transactional(readOnly = true)
    public List<PosDeviceResponse> listDevices(String email, UUID storeId) {
        User user = requireUser(email);
        requireOwnedStore(storeId, user.getId());
        List<BrewPosDevice> devices = posDeviceRepository.findByStoreIdOrderByCreatedAtAsc(storeId);
        Map<UUID, String> nicknames = userService.nicknameMap(
                devices.stream().map(BrewPosDevice::getEnrolledByUserId).toList());
        return devices.stream()
                .map(device -> new PosDeviceResponse(
                        device.getId(),
                        device.getDeviceId(),
                        nicknames.getOrDefault(device.getEnrolledByUserId(), ""),
                        device.getCreatedAt()))
                .toList();
    }

    @Transactional
    public void revokeDevice(String email, UUID storeId, UUID deviceRowId) {
        User user = requireUser(email);
        requireOwnedStore(storeId, user.getId());
        BrewPosDevice device = posDeviceRepository.findById(deviceRowId)
                .orElseThrow(() -> new BusinessException(
                        HttpStatus.NOT_FOUND, "POS_DEVICE_NOT_FOUND", "POS 기기를 찾을 수 없습니다."));
        if (!device.getStoreId().equals(storeId)) {
            throw new BusinessException(HttpStatus.NOT_FOUND, "POS_DEVICE_NOT_FOUND", "POS 기기를 찾을 수 없습니다.");
        }
        posDeviceRepository.delete(device);
        posRedisService.deleteSession(device.getDeviceId());
    }

    private void enroll(UUID storeId, String deviceId, UUID ownerId) {
        if (posDeviceRepository.findByStoreIdAndDeviceId(storeId, deviceId).isPresent()) {
            return;
        }
        if (posDeviceRepository.countByStoreId(storeId) >= MAX_DEVICES) {
            throw new BusinessException(
                    HttpStatus.CONFLICT,
                    "POS_DEVICE_LIMIT",
                    "POS는 가게당 3대까지 등록할 수 있습니다.");
        }
        posDeviceRepository.save(BrewPosDevice.builder()
                .storeId(storeId)
                .deviceId(deviceId)
                .enrolledByUserId(ownerId)
                .build());
    }

    private boolean resolveCanEditStock(BrewStore store, UUID userId) {
        if (store.getOwnerUserId().equals(userId)) {
            return true;
        }
        return subscriptionRepository
                .findBySubscriberUserIdAndStoreId(userId, store.getId())
                .filter(sub -> !brewScheduleService.isLeaveFinalizeDue(
                        store.getId(), userId, sub.getLeaveDate()))
                .map(BrewStoreSubscription::isCanEditStock)
                .orElseThrow(() -> new BusinessException(
                        HttpStatus.FORBIDDEN,
                        "POS_NOT_MEMBER",
                        "이 가게 구성원만 POS를 연결할 수 있습니다."));
    }

    private PosTokenResponse issueToken(
            User user,
            UUID storeId,
            boolean canEditStock,
            String deviceId
    ) {
        String token = jwtTokenProvider.createPosToken(user, storeId, canEditStock, deviceId);
        return new PosTokenResponse(
                token,
                storeId,
                canEditStock,
                jwtTokenProvider.getExpiry(token),
                deviceId);
    }

    private String randomSecret() {
        byte[] bytes = new byte[16];
        secureRandom.nextBytes(bytes);
        return HexFormat.of().formatHex(bytes);
    }

    private static BusinessException qrChanged() {
        return new BusinessException(
                HttpStatus.GONE, "POS_QR_CHANGED", "QR이 바뀌었습니다. 지금 화면에 있는 코드를 다시 찍어 주세요.");
    }

    private User requireUser(String email) {
        return userService.findByEmail(email.trim().toLowerCase())
                .orElseThrow(() -> new BusinessException(
                        HttpStatus.UNAUTHORIZED, "LOGIN_REQUIRED", "로그인이 필요합니다."));
    }

    private BrewStore requireStore(UUID storeId) {
        return storeRepository.findById(storeId)
                .orElseThrow(() -> new BusinessException(
                        HttpStatus.NOT_FOUND, "STORE_NOT_FOUND", "가게를 찾을 수 없습니다."));
    }

    private BrewStore requireOwnedStore(UUID storeId, UUID ownerId) {
        PosAccess.forbidManagement();
        BrewStore store = requireStore(storeId);
        if (!store.getOwnerUserId().equals(ownerId)) {
            throw new BusinessException(HttpStatus.FORBIDDEN, "OWNER_ONLY", "가게 소유자만 관리할 수 있습니다.");
        }
        return store;
    }
}
