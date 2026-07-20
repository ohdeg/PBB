package com.studiobs.spring_backend.domain.brew.service;

import com.studiobs.spring_backend.domain.brew.dto.TimerPresetRequest;
import com.studiobs.spring_backend.domain.brew.dto.TimerPresetResponse;
import com.studiobs.spring_backend.domain.brew.dto.TimerPresetStepRequest;
import com.studiobs.spring_backend.domain.brew.dto.TimerPresetStepResponse;
import com.studiobs.spring_backend.domain.brew.entity.BrewStore;
import com.studiobs.spring_backend.domain.brew.entity.BrewTimerPreset;
import com.studiobs.spring_backend.domain.brew.repository.BrewStoreRepository;
import com.studiobs.spring_backend.domain.brew.repository.BrewStoreSubscriptionRepository;
import com.studiobs.spring_backend.domain.brew.repository.BrewTimerPresetRepository;
import com.studiobs.spring_backend.domain.user.entity.User;
import com.studiobs.spring_backend.domain.user.service.UserService;
import com.studiobs.spring_backend.global.exception.BusinessException;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.core.JacksonException;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;

@Service
@RequiredArgsConstructor
public class BrewTimerPresetService {

    private final UserService userService;
    private final BrewStoreRepository storeRepository;
    private final BrewStoreSubscriptionRepository subscriptionRepository;
    private final BrewTimerPresetRepository presetRepository;
    private final ObjectMapper objectMapper;

    @Transactional(readOnly = true)
    public List<TimerPresetResponse> listPersonal(String email) {
        User user = requireUser(email);
        return presetRepository
                .findByScopeAndUserIdOrderByUpdatedAtDesc(BrewTimerPreset.SCOPE_PERSONAL, user.getId())
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<TimerPresetResponse> listStore(String email, UUID storeId) {
        User user = requireUser(email);
        BrewStore store = requireStore(storeId);
        assertMember(store, user.getId());
        return presetRepository
                .findByScopeAndStoreIdOrderByUpdatedAtDesc(BrewTimerPreset.SCOPE_STORE, storeId)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public TimerPresetResponse createPersonal(String email, TimerPresetRequest request) {
        User user = requireUser(email);
        BrewTimerPreset preset = BrewTimerPreset.builder()
                .scope(BrewTimerPreset.SCOPE_PERSONAL)
                .userId(user.getId())
                .storeId(null)
                .createdByUserId(user.getId())
                .name(normalizeName(request.name()))
                .steps(serializeSteps(request.steps()))
                .build();
        return toResponse(presetRepository.save(preset));
    }

    @Transactional
    public TimerPresetResponse createStore(String email, UUID storeId, TimerPresetRequest request) {
        User user = requireUser(email);
        BrewStore store = requireStore(storeId);
        assertMember(store, user.getId());
        BrewTimerPreset preset = BrewTimerPreset.builder()
                .scope(BrewTimerPreset.SCOPE_STORE)
                .userId(null)
                .storeId(storeId)
                .createdByUserId(user.getId())
                .name(normalizeName(request.name()))
                .steps(serializeSteps(request.steps()))
                .build();
        return toResponse(presetRepository.save(preset));
    }

    @Transactional
    public TimerPresetResponse updatePersonal(String email, UUID presetId, TimerPresetRequest request) {
        User user = requireUser(email);
        BrewTimerPreset preset = requirePreset(presetId);
        if (!BrewTimerPreset.SCOPE_PERSONAL.equals(preset.getScope())
                || preset.getUserId() == null
                || !preset.getUserId().equals(user.getId())) {
            throw new BusinessException(HttpStatus.FORBIDDEN, "본인 프리셋만 수정할 수 있습니다.");
        }
        preset.update(normalizeName(request.name()), serializeSteps(request.steps()));
        return toResponse(preset);
    }

    @Transactional
    public TimerPresetResponse updateStore(
            String email,
            UUID storeId,
            UUID presetId,
            TimerPresetRequest request
    ) {
        User user = requireUser(email);
        BrewStore store = requireStore(storeId);
        assertMember(store, user.getId());
        BrewTimerPreset preset = requirePreset(presetId);
        if (!BrewTimerPreset.SCOPE_STORE.equals(preset.getScope())
                || preset.getStoreId() == null
                || !preset.getStoreId().equals(storeId)) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "이 가게의 프리셋이 아닙니다.");
        }
        preset.update(normalizeName(request.name()), serializeSteps(request.steps()));
        return toResponse(preset);
    }

    @Transactional
    public void deletePersonal(String email, UUID presetId) {
        User user = requireUser(email);
        BrewTimerPreset preset = requirePreset(presetId);
        if (!BrewTimerPreset.SCOPE_PERSONAL.equals(preset.getScope())
                || preset.getUserId() == null
                || !preset.getUserId().equals(user.getId())) {
            throw new BusinessException(HttpStatus.FORBIDDEN, "본인 프리셋만 삭제할 수 있습니다.");
        }
        presetRepository.delete(preset);
    }

    @Transactional
    public void deleteStore(String email, UUID storeId, UUID presetId) {
        User user = requireUser(email);
        BrewStore store = requireStore(storeId);
        assertMember(store, user.getId());
        BrewTimerPreset preset = requirePreset(presetId);
        if (!BrewTimerPreset.SCOPE_STORE.equals(preset.getScope())
                || preset.getStoreId() == null
                || !preset.getStoreId().equals(storeId)) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "이 가게의 프리셋이 아닙니다.");
        }
        presetRepository.delete(preset);
    }

    private TimerPresetResponse toResponse(BrewTimerPreset preset) {
        return new TimerPresetResponse(
                preset.getId(),
                preset.getScope(),
                preset.getUserId(),
                preset.getStoreId(),
                preset.getCreatedByUserId(),
                preset.getName(),
                deserializeSteps(preset.getSteps()),
                preset.getCreatedAt(),
                preset.getUpdatedAt()
        );
    }

    private String serializeSteps(List<TimerPresetStepRequest> steps) {
        List<TimerPresetStepResponse> normalized = steps.stream()
                .map(step -> new TimerPresetStepResponse(
                        step.name().trim().isEmpty() ? "단계" : step.name().trim(),
                        Math.max(1000L, step.durationMs())
                ))
                .toList();
        if (normalized.isEmpty()) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "단계가 필요합니다.");
        }
        try {
            return objectMapper.writeValueAsString(normalized);
        } catch (JacksonException e) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "단계 직렬화에 실패했습니다.");
        }
    }

    private List<TimerPresetStepResponse> deserializeSteps(String raw) {
        try {
            return objectMapper.readValue(raw, new TypeReference<>() {});
        } catch (JacksonException e) {
            return List.of();
        }
    }

    private String normalizeName(String name) {
        String trimmed = name.trim();
        return trimmed.isEmpty() ? "프리셋" : trimmed;
    }

    private User requireUser(String email) {
        return userService.findByEmail(email.trim().toLowerCase())
                .orElseThrow(() -> new BusinessException(HttpStatus.UNAUTHORIZED, "로그인이 필요합니다."));
    }

    private BrewStore requireStore(UUID storeId) {
        return storeRepository.findById(storeId)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "가게를 찾을 수 없습니다."));
    }

    private BrewTimerPreset requirePreset(UUID presetId) {
        return presetRepository.findById(presetId)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "프리셋을 찾을 수 없습니다."));
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
}
