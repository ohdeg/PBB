package com.studiobs.spring_backend.domain.sranko.client;

import com.studiobs.spring_backend.domain.sranko.config.SrankoWeatherProperties;
import com.studiobs.spring_backend.domain.sranko.dto.SrankoPlaceSearchHit;
import com.studiobs.spring_backend.domain.sranko.dto.SrankoWeatherHourlyItem;
import com.studiobs.spring_backend.domain.sranko.dto.SrankoWeatherResponse;
import com.studiobs.spring_backend.global.exception.BusinessException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@Slf4j
@Component
public class WeatherApiClient {

    private static final DateTimeFormatter HOUR_FMT =
            DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");
    /** Rolling window from local now (inclusive of current hour). */
    private static final int HOURLY_WINDOW = 12;

    private final SrankoWeatherProperties properties;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;

    public WeatherApiClient(SrankoWeatherProperties properties, ObjectMapper objectMapper) {
        this.properties = properties;
        this.objectMapper = objectMapper;
        this.httpClient = HttpClient.newBuilder()
                .version(HttpClient.Version.HTTP_1_1)
                .connectTimeout(Duration.ofSeconds(5))
                .build();
    }

    public SrankoWeatherResponse fetchCurrent(double lat, double lon) {
        return fetchForecastBundle(lat, lon);
    }

    /**
     * Forecast endpoint (includes {@code current} + next {@link #HOURLY_WINDOW} hours).
     * Uses {@code days=2} so the window can cross midnight.
     */
    public SrankoWeatherResponse fetchForecastBundle(double lat, double lon) {
        requireApiKey();
        String q = String.format(Locale.ROOT, "%.4f,%.4f", lat, lon);
        String url = baseUrl() + "/v1/forecast.json?key="
                + URLEncoder.encode(properties.apiKey(), StandardCharsets.UTF_8)
                + "&q=" + URLEncoder.encode(q, StandardCharsets.UTF_8)
                + "&days=2&aqi=no&alerts=no";
        String body = getJson(url);
        return parseForecastBundle(body, false);
    }

    public List<SrankoPlaceSearchHit> searchPlaces(String query) {
        requireApiKey();
        String trimmed = query != null ? query.trim() : "";
        if (trimmed.length() < 2) {
            return List.of();
        }
        String url = baseUrl() + "/v1/search.json?key="
                + URLEncoder.encode(properties.apiKey(), StandardCharsets.UTF_8)
                + "&q=" + URLEncoder.encode(trimmed, StandardCharsets.UTF_8);
        String body = getJson(url);
        return parseSearch(body);
    }

    public SrankoWeatherResponse parseForecastBundle(String json, boolean cached) {
        try {
            JsonNode root = objectMapper.readTree(json);
            JsonNode current = root.path("current");
            if (current.isMissingNode() || current.isNull()) {
                throw new BusinessException(HttpStatus.BAD_GATEWAY, "날씨 응답이 올바르지 않습니다.");
            }
            JsonNode condition = current.path("condition");
            String text = textOrNull(condition.path("text"));
            Integer conditionCode = intOrNull(condition.path("code"));
            Double tempC = doubleOrNull(current.path("temp_c"));
            Integer humidity = intOrNull(current.path("humidity"));
            Double windKph = doubleOrNull(current.path("wind_kph"));
            if (tempC == null) {
                throw new BusinessException(HttpStatus.BAD_GATEWAY, "날씨 응답에 온도가 없습니다.");
            }
            List<SrankoWeatherHourlyItem> hourly = parseHourly(root);
            return new SrankoWeatherResponse(
                    text,
                    conditionCode,
                    tempC,
                    humidity,
                    windKph,
                    cached,
                    false,
                    hourly
            );
        } catch (BusinessException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new BusinessException(HttpStatus.BAD_GATEWAY, "날씨 응답을 해석하지 못했습니다.");
        }
    }

    private List<SrankoWeatherHourlyItem> parseHourly(JsonNode root) {
        JsonNode days = root.path("forecast").path("forecastday");
        if (!days.isArray() || days.isEmpty()) {
            return List.of();
        }
        LocalDateTime nowFloor = null;
        String localtime = textOrNull(root.path("location").path("localtime"));
        if (localtime != null) {
            try {
                nowFloor = LocalDateTime.parse(localtime, HOUR_FMT).withMinute(0).withSecond(0).withNano(0);
            } catch (Exception ignored) {
                // fall through
            }
        }
        if (nowFloor == null) {
            nowFloor = LocalDateTime.now().withMinute(0).withSecond(0).withNano(0);
        }
        List<SrankoWeatherHourlyItem> out = new ArrayList<>();
        for (JsonNode day : days) {
            JsonNode hours = day.path("hour");
            if (!hours.isArray()) {
                continue;
            }
            for (JsonNode hour : hours) {
                String time = textOrNull(hour.path("time"));
                if (time == null) {
                    continue;
                }
                LocalDateTime slot;
                try {
                    slot = LocalDateTime.parse(time, HOUR_FMT);
                } catch (Exception ex) {
                    continue;
                }
                if (slot.isBefore(nowFloor)) {
                    continue;
                }
                Double temp = doubleOrNull(hour.path("temp_c"));
                if (temp == null) {
                    continue;
                }
                JsonNode condition = hour.path("condition");
                out.add(new SrankoWeatherHourlyItem(
                        time,
                        textOrNull(condition.path("text")),
                        intOrNull(condition.path("code")),
                        temp,
                        intOrNull(hour.path("chance_of_rain"))
                ));
                if (out.size() >= HOURLY_WINDOW) {
                    return List.copyOf(out);
                }
            }
        }
        return List.copyOf(out);
    }

    private List<SrankoPlaceSearchHit> parseSearch(String json) {
        try {
            JsonNode root = objectMapper.readTree(json);
            if (!root.isArray()) {
                return List.of();
            }
            List<SrankoPlaceSearchHit> out = new ArrayList<>();
            for (JsonNode node : root) {
                Double lat = doubleOrNull(node.path("lat"));
                Double lon = doubleOrNull(node.path("lon"));
                String name = textOrNull(node.path("name"));
                if (lat == null || lon == null || name == null) {
                    continue;
                }
                out.add(new SrankoPlaceSearchHit(
                        name,
                        textOrNull(node.path("region")),
                        textOrNull(node.path("country")),
                        lat,
                        lon
                ));
                if (out.size() >= 8) {
                    break;
                }
            }
            return List.copyOf(out);
        } catch (Exception ex) {
            log.warn("[WeatherAPI] search parse failed: {}", ex.getMessage());
            throw new BusinessException(HttpStatus.BAD_GATEWAY, "장소 검색 결과를 해석하지 못했습니다.");
        }
    }

    public String toCacheJson(SrankoWeatherResponse weather) {
        try {
            return objectMapper.writeValueAsString(weather);
        } catch (Exception ex) {
            throw new BusinessException(HttpStatus.INTERNAL_SERVER_ERROR, "날씨 캐시를 저장할 수 없습니다.");
        }
    }

    public SrankoWeatherResponse fromCacheJson(String json) {
        try {
            SrankoWeatherResponse parsed = objectMapper.readValue(json, SrankoWeatherResponse.class);
            if (parsed == null || parsed.tempC() == null) {
                throw new BusinessException(HttpStatus.INTERNAL_SERVER_ERROR, "날씨 캐시가 손상되었습니다.");
            }
            List<SrankoWeatherHourlyItem> hourly =
                    parsed.hourly() != null ? parsed.hourly() : List.of();
            return new SrankoWeatherResponse(
                    parsed.condition(),
                    parsed.conditionCode(),
                    parsed.tempC(),
                    parsed.humidity(),
                    parsed.windKph(),
                    true,
                    false,
                    hourly
            );
        } catch (BusinessException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new BusinessException(HttpStatus.INTERNAL_SERVER_ERROR, "날씨 캐시를 읽지 못했습니다.");
        }
    }

    private String getJson(String url) {
        HttpRequest request = HttpRequest.newBuilder(URI.create(url))
                .timeout(Duration.ofSeconds(15))
                .header("Accept", "application/json")
                .GET()
                .build();
        try {
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            int code = response.statusCode();
            String body = response.body() != null ? response.body() : "";
            if (code >= 400) {
                log.warn("[WeatherAPI] HTTP {}: {}", code, truncate(body, 300));
                throw new BusinessException(
                        HttpStatus.BAD_GATEWAY,
                        "날씨 서비스 오류(" + code + ")"
                );
            }
            return body;
        } catch (BusinessException ex) {
            throw ex;
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            throw new BusinessException(HttpStatus.BAD_GATEWAY, "날씨 서비스 호출이 중단되었습니다.");
        } catch (Exception ex) {
            log.warn("[WeatherAPI] fetch failed: {}", ex.getMessage());
            throw new BusinessException(HttpStatus.BAD_GATEWAY, "날씨 정보를 가져오지 못했습니다.");
        }
    }

    private void requireApiKey() {
        if (!properties.hasApiKey()) {
            throw new BusinessException(
                    HttpStatus.BAD_GATEWAY,
                    "날씨 API 키가 없습니다. WEATHERAPI_KEY 를 설정하세요."
            );
        }
    }

    private String baseUrl() {
        String base = properties.baseUrl();
        return base.endsWith("/") ? base.substring(0, base.length() - 1) : base;
    }

    private static String textOrNull(JsonNode node) {
        if (node == null || node.isMissingNode() || node.isNull()) {
            return null;
        }
        String value = node.asText();
        return value == null || value.isBlank() ? null : value.trim();
    }

    private static Integer intOrNull(JsonNode node) {
        if (node == null || node.isMissingNode() || node.isNull() || !node.isNumber()) {
            return null;
        }
        return node.asInt();
    }

    private static Double doubleOrNull(JsonNode node) {
        if (node == null || node.isMissingNode() || node.isNull() || !node.isNumber()) {
            return null;
        }
        return node.asDouble();
    }

    private static String truncate(String value, int max) {
        if (value == null) {
            return "";
        }
        String trimmed = value.trim();
        return trimmed.length() <= max ? trimmed : trimmed.substring(0, max) + "…";
    }
}
