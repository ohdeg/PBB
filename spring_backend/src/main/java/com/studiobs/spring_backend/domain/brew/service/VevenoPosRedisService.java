package com.studiobs.spring_backend.domain.brew.service;

import com.studiobs.spring_backend.domain.brew.dto.PosPairState;
import com.studiobs.spring_backend.domain.brew.dto.PosSessionState;
import com.studiobs.spring_backend.global.exception.BusinessException;
import java.time.Duration;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.ObjectMapper;

@Service
@RequiredArgsConstructor
public class VevenoPosRedisService {

    static final Duration PAIR_TTL = Duration.ofMinutes(2);
    static final Duration SESSION_TTL = Duration.ofHours(12);
    private static final String PAIR_PREFIX = "veveno:pos:pair:";
    private static final String SESS_PREFIX = "veveno:pos:sess:";

    private final StringRedisTemplate stringRedisTemplate;
    private final ObjectMapper objectMapper;

    public void savePair(UUID pairId, PosPairState state) {
        setJson(pairKey(pairId), state, PAIR_TTL);
    }

    public PosPairState getPair(UUID pairId) {
        return getJson(pairKey(pairId), PosPairState.class);
    }

    public PosPairState takePair(UUID pairId) {
        String raw = stringRedisTemplate.opsForValue().getAndDelete(pairKey(pairId));
        return decode(raw, PosPairState.class);
    }

    public void saveSession(PosSessionState state) {
        setJson(sessKey(state.deviceId()), state, SESSION_TTL);
    }

    public PosSessionState getSession(String deviceId) {
        return getJson(sessKey(deviceId), PosSessionState.class);
    }

    public void deleteSession(String deviceId) {
        stringRedisTemplate.delete(sessKey(deviceId));
    }

    public Long sessionTtlSeconds(String deviceId) {
        return stringRedisTemplate.getExpire(sessKey(deviceId));
    }

    private void setJson(String key, Object value, Duration ttl) {
        try {
            stringRedisTemplate.opsForValue().set(key, objectMapper.writeValueAsString(value), ttl);
        } catch (JacksonException ex) {
            throw new BusinessException(HttpStatus.INTERNAL_SERVER_ERROR, "POS_REDIS", "POS 상태를 저장할 수 없습니다.");
        }
    }

    private <T> T getJson(String key, Class<T> type) {
        return decode(stringRedisTemplate.opsForValue().get(key), type);
    }

    private <T> T decode(String raw, Class<T> type) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        try {
            return objectMapper.readValue(raw, type);
        } catch (JacksonException ex) {
            return null;
        }
    }

    private static String pairKey(UUID pairId) {
        return PAIR_PREFIX + pairId;
    }

    private static String sessKey(String deviceId) {
        return SESS_PREFIX + deviceId;
    }
}
