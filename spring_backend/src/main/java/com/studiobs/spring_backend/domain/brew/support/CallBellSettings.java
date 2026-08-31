package com.studiobs.spring_backend.domain.brew.support;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.json.JsonMapper;

/** Stored in brew_stores.call_bell_phrase as JSON, or a legacy plain phrase. */
@JsonInclude(JsonInclude.Include.NON_NULL)
@JsonIgnoreProperties(ignoreUnknown = true)
public record CallBellSettings(String phrase, Double rate, Double pitch) {

    private static final ObjectMapper MAPPER = JsonMapper.builder().build();

    public static CallBellSettings empty() {
        return new CallBellSettings(null, null, null);
    }

    public static CallBellSettings parse(String raw) {
        if (raw == null || raw.isBlank()) {
            return empty();
        }
        String trimmed = raw.trim();
        if (trimmed.startsWith("{")) {
            try {
                CallBellSettings parsed = MAPPER.readValue(trimmed, CallBellSettings.class);
                return parsed == null ? empty() : parsed.normalized();
            } catch (Exception ignored) {
                return new CallBellSettings(trimmed, null, null);
            }
        }
        return new CallBellSettings(trimmed, null, null);
    }

    public static CallBellSettings fromRequest(String phrase, Double rate, Double pitch) {
        return new CallBellSettings(phrase, rate, pitch).normalized();
    }

    public String toStorage() {
        CallBellSettings normalized = normalized();
        if (normalized.phrase() == null && normalized.rate() == null && normalized.pitch() == null) {
            return null;
        }
        return MAPPER.writeValueAsString(normalized);
    }

    private CallBellSettings normalized() {
        return new CallBellSettings(blankToNull(phrase), clampRate(rate), clampPitch(pitch));
    }

    private static String blankToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    static Double clampRate(Double value) {
        if (value == null) {
            return null;
        }
        return Math.min(2.0, Math.max(0.5, value));
    }

    static Double clampPitch(Double value) {
        if (value == null) {
            return null;
        }
        return Math.min(2.0, Math.max(0.0, value));
    }
}
