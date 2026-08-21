package com.studiobs.spring_backend.domain.brew.service;

import com.studiobs.spring_backend.domain.brew.dto.BrewStatsResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class BrewRedisService {

    private static final Duration JOIN_TTL = Duration.ofHours(24);
    private static final Duration STATS_TTL = Duration.ofHours(1);
    /** 신규 키 */
    private static final String JOIN_PREFIX = "veveno:join:";
    /** 하위 호환 (전환 기간 읽기) */
    private static final String LEGACY_JOIN_PREFIX = "brew:join:";
    static final String STATS_KEY = "veveno:stats";

    private final StringRedisTemplate stringRedisTemplate;

    public void saveJoinRequest(UUID storeId, UUID userId) {
        stringRedisTemplate.opsForValue()
                .set(joinKey(storeId, userId), "pending", JOIN_TTL);
        // 구 키는 제거해 중복 pending을 막는다
        stringRedisTemplate.delete(legacyJoinKey(storeId, userId));
    }

    public boolean hasJoinRequest(UUID storeId, UUID userId) {
        return Boolean.TRUE.equals(stringRedisTemplate.hasKey(joinKey(storeId, userId)))
                || Boolean.TRUE.equals(stringRedisTemplate.hasKey(legacyJoinKey(storeId, userId)));
    }

    public void deleteJoinRequest(UUID storeId, UUID userId) {
        stringRedisTemplate.delete(List.of(
                joinKey(storeId, userId),
                legacyJoinKey(storeId, userId)
        ));
    }

    public List<UUID> listJoinRequesterIds(UUID storeId) {
        Set<UUID> ids = new LinkedHashSet<>();
        collectRequesterIds(ids, JOIN_PREFIX, storeId);
        collectRequesterIds(ids, LEGACY_JOIN_PREFIX, storeId);
        return new ArrayList<>(ids);
    }

    public BrewStatsResponse getCachedStats() {
        try {
            String raw = stringRedisTemplate.opsForValue().get(STATS_KEY);
            if (raw == null || raw.isBlank()) {
                return null;
            }
            int sep = raw.indexOf(':');
            if (sep <= 0 || sep == raw.length() - 1) {
                return null;
            }
            return new BrewStatsResponse(
                    Long.parseLong(raw.substring(0, sep)),
                    Long.parseLong(raw.substring(sep + 1)));
        } catch (RuntimeException ignored) {
            return null;
        }
    }

    public void saveStats(BrewStatsResponse stats) {
        try {
            stringRedisTemplate.opsForValue().set(
                    STATS_KEY,
                    stats.ownerCount() + ":" + stats.storeCount(),
                    STATS_TTL);
        } catch (RuntimeException ignored) {
            /* 랜딩은 다음 요청에서 DB로 다시 채움 */
        }
    }

    private void collectRequesterIds(Set<UUID> ids, String prefix, UUID storeId) {
        String pattern = prefix + storeId + ":*";
        Set<String> keys = stringRedisTemplate.keys(pattern);
        if (keys == null || keys.isEmpty()) {
            return;
        }
        String keyPrefix = prefix + storeId + ":";
        for (String key : keys) {
            if (key.startsWith(keyPrefix)) {
                ids.add(UUID.fromString(key.substring(keyPrefix.length())));
            }
        }
    }

    private String joinKey(UUID storeId, UUID userId) {
        return JOIN_PREFIX + storeId + ":" + userId;
    }

    private String legacyJoinKey(UUID storeId, UUID userId) {
        return LEGACY_JOIN_PREFIX + storeId + ":" + userId;
    }
}
