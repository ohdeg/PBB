package com.studiobs.spring_backend.domain.dieta.service;

import com.studiobs.spring_backend.domain.dieta.dto.meal.DietaMealQueueDayResponse;
import com.studiobs.spring_backend.domain.dieta.dto.meal.DietaMealQueueItemDto;
import com.studiobs.spring_backend.global.exception.BusinessException;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.ObjectMapper;

@Service
@RequiredArgsConstructor
public class DietaMealQueueRedisService {

    private static final String KEY_PREFIX = "dieta:mealq:";
    private static final Duration TTL = Duration.ofHours(48);

    private final StringRedisTemplate stringRedisTemplate;
    private final ObjectMapper objectMapper;

    public DietaMealQueueDayResponse getOrEmpty(UUID userId, LocalDate loggedOn) {
        String raw = stringRedisTemplate.opsForValue().get(key(userId, loggedOn));
        if (raw == null || raw.isBlank()) {
            return DietaMealQueueDayResponse.empty(loggedOn);
        }
        return deserialize(raw, loggedOn);
    }

    public DietaMealQueueDayResponse save(UUID userId, DietaMealQueueDayResponse day) {
        DietaMealQueueDayResponse toStore = new DietaMealQueueDayResponse(
                day.loggedOn(),
                day.status(),
                day.items() != null ? List.copyOf(day.items()) : List.of(),
                day.updatedAt() != null ? day.updatedAt() : Instant.now());
        try {
            String json = objectMapper.writeValueAsString(toStore);
            stringRedisTemplate.opsForValue().set(key(userId, toStore.loggedOn()), json, TTL);
            return toStore;
        } catch (JacksonException ex) {
            throw new BusinessException(HttpStatus.INTERNAL_SERVER_ERROR, "식사 큐를 저장할 수 없습니다.");
        }
    }

    public DietaMealQueueDayResponse withStatus(
            DietaMealQueueDayResponse day,
            String status
    ) {
        return new DietaMealQueueDayResponse(
                day.loggedOn(),
                status,
                day.items(),
                Instant.now());
    }

    public DietaMealQueueDayResponse addItem(
            DietaMealQueueDayResponse day,
            String mealType,
            String text
    ) {
        List<DietaMealQueueItemDto> items = new ArrayList<>(
                day.items() != null ? day.items() : List.of());
        items.add(new DietaMealQueueItemDto(
                UUID.randomUUID().toString(),
                mealType,
                text,
                Instant.now()));
        return new DietaMealQueueDayResponse(day.loggedOn(), "open", items, Instant.now());
    }

    public DietaMealQueueDayResponse removeItem(DietaMealQueueDayResponse day, String itemId) {
        List<DietaMealQueueItemDto> items = (day.items() != null ? day.items() : List.<DietaMealQueueItemDto>of())
                .stream()
                .filter(i -> !itemId.equals(i.id()))
                .toList();
        return new DietaMealQueueDayResponse(day.loggedOn(), day.status(), items, Instant.now());
    }

    private DietaMealQueueDayResponse deserialize(String raw, LocalDate loggedOn) {
        try {
            DietaMealQueueDayResponse parsed = objectMapper.readValue(raw, DietaMealQueueDayResponse.class);
            if (parsed.items() == null) {
                return new DietaMealQueueDayResponse(
                        parsed.loggedOn() != null ? parsed.loggedOn() : loggedOn,
                        parsed.status() != null ? parsed.status() : "open",
                        List.of(),
                        parsed.updatedAt() != null ? parsed.updatedAt() : Instant.now());
            }
            return parsed;
        } catch (JacksonException ex) {
            throw new BusinessException(HttpStatus.INTERNAL_SERVER_ERROR, "식사 큐를 읽을 수 없습니다.");
        }
    }

    private static String key(UUID userId, LocalDate loggedOn) {
        return KEY_PREFIX + userId + ":" + loggedOn;
    }
}
