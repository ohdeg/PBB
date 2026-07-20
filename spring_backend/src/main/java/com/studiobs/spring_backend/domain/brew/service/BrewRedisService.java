package com.studiobs.spring_backend.domain.brew.service;

import java.time.Duration;
import java.util.ArrayList;
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
    private static final String JOIN_PREFIX = "brew:join:";

    private final StringRedisTemplate stringRedisTemplate;

    public void saveJoinRequest(UUID storeId, UUID userId) {
        stringRedisTemplate.opsForValue()
                .set(joinKey(storeId, userId), "pending", JOIN_TTL);
    }

    public boolean hasJoinRequest(UUID storeId, UUID userId) {
        return Boolean.TRUE.equals(stringRedisTemplate.hasKey(joinKey(storeId, userId)));
    }

    public void deleteJoinRequest(UUID storeId, UUID userId) {
        stringRedisTemplate.delete(joinKey(storeId, userId));
    }

    public List<UUID> listJoinRequesterIds(UUID storeId) {
        String pattern = JOIN_PREFIX + storeId + ":*";
        Set<String> keys = stringRedisTemplate.keys(pattern);
        if (keys == null || keys.isEmpty()) {
            return List.of();
        }
        List<UUID> ids = new ArrayList<>();
        String prefix = JOIN_PREFIX + storeId + ":";
        for (String key : keys) {
            if (key.startsWith(prefix)) {
                ids.add(UUID.fromString(key.substring(prefix.length())));
            }
        }
        return ids;
    }

    private String joinKey(UUID storeId, UUID userId) {
        return JOIN_PREFIX + storeId + ":" + userId;
    }
}
