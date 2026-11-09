package com.studiobs.spring_backend.domain.dieta.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.studiobs.spring_backend.domain.dieta.dto.meal.DietaMealQueueDayResponse;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import tools.jackson.databind.json.JsonMapper;

class DietaMealQueueRedisServiceTest {
    @Test
    void readsLegacyRedisQueueWithoutLosingItsPendingMeal() {
        var user = UUID.randomUUID();
        var day = LocalDate.parse("2026-11-09");
        var redis = mock(StringRedisTemplate.class);
        ValueOperations<String, String> values = mock();
        when(redis.opsForValue()).thenReturn(values);
        when(values.get("dieta:mealq:" + user + ":" + day)).thenReturn("""
                {"loggedOn":"2026-11-09","status":"pending","updatedAt":"2026-11-09T02:00:00Z",
                 "items":[{"id":"item-1","mealType":"LUNCH","text":"밥","addedAt":"2026-11-09T01:00:00Z"}]}
                """);
        var mapper = JsonMapper.builder().build();
        var queue = new DietaMealQueueRedisService(redis, mapper).getOrEmpty(user, day);
        assertThat(queue.loggedOn()).isEqualTo(day);
        assertThat(queue.status()).isEqualTo("pending");
        assertThat(queue.updatedAt()).isEqualTo(Instant.parse("2026-11-09T02:00:00Z"));
        assertThat(queue.items()).singleElement().satisfies(item -> {
            assertThat(item.id()).isEqualTo("item-1");
            assertThat(item.text()).isEqualTo("밥");
        });
        assertThat(queue.newItemCount()).isZero();

        var current = new DietaMealQueueDayResponse(day, "open", queue.items(), queue.updatedAt(),
                "SUPPLEMENT", 1, day.minusDays(1));
        assertThat(mapper.readValue(mapper.writeValueAsString(current), DietaMealQueueDayResponse.class))
                .isEqualTo(current);
    }
}
