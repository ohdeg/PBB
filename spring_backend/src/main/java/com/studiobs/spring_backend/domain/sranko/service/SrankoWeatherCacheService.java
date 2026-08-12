package com.studiobs.spring_backend.domain.sranko.service;

import com.studiobs.spring_backend.domain.sranko.client.WeatherApiClient;
import com.studiobs.spring_backend.domain.sranko.dto.SrankoWeatherResponse;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class SrankoWeatherCacheService {

    private static final String KEY_PREFIX = "sranko:forecast:";
    private static final Duration TTL = Duration.ofMinutes(30);

    private final StringRedisTemplate stringRedisTemplate;
    private final WeatherApiClient weatherApiClient;

    public SrankoWeatherResponse getOrFetch(double lat, double lon) {
        String key = cacheKey(lat, lon);
        String cached = stringRedisTemplate.opsForValue().get(key);
        if (cached != null && !cached.isBlank()) {
            return weatherApiClient.fromCacheJson(cached);
        }
        SrankoWeatherResponse fresh = weatherApiClient.fetchForecastBundle(lat, lon);
        stringRedisTemplate.opsForValue().set(key, weatherApiClient.toCacheJson(fresh), TTL);
        return new SrankoWeatherResponse(
                fresh.condition(),
                fresh.conditionCode(),
                fresh.tempC(),
                fresh.humidity(),
                fresh.windKph(),
                false,
                false,
                fresh.hourly() != null ? fresh.hourly() : java.util.List.of()
        );
    }

    static String cacheKey(double lat, double lon) {
        return KEY_PREFIX + roundCoord(lat) + ":" + roundCoord(lon);
    }

    static String roundCoord(double value) {
        return BigDecimal.valueOf(value)
                .setScale(2, RoundingMode.HALF_UP)
                .toPlainString();
    }
}
