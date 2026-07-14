package com.studiobs.spring_backend.domain.auth.consent;

import java.util.Arrays;
import java.util.List;

/**
 * 회원가입 동의 카탈로그.
 * 프론트 {@code consents.ts} 와 키·필수 여부를 맞춥니다.
 * 신규 항목은 여기에 추가하고 {@code enabled=true} 로 켜면 서버 검증에 반영됩니다.
 */
public enum ConsentCatalog {
    TERMS("terms", true, true, "2026-07-15"),
    PRIVACY("privacy", true, true, "2026-07-15"),
    AGE14("age14", true, true, "2026-07-15"),
    MARKETING_PRIVACY("marketing_privacy", true, false, "2026-07-15"),
    MARKETING_EMAIL("marketing_email", true, false, "2026-07-15"),
    MARKETING_SMS("marketing_sms", true, false, "2026-07-15"),
    MARKETING_PUSH("marketing_push", true, false, "2026-07-15"),
    LOCATION("location", false, true, "2026-07-15"),
    THIRD_PARTY("third_party", false, true, "2026-07-15"),
    SOCIAL_LOGIN("social_login", false, true, "2026-07-15");

    private final String key;
    private final boolean enabled;
    private final boolean required;
    private final String version;

    ConsentCatalog(String key, boolean enabled, boolean required, String version) {
        this.key = key;
        this.enabled = enabled;
        this.required = required;
        this.version = version;
    }

    public String key() {
        return key;
    }

    public boolean enabled() {
        return enabled;
    }

    public boolean required() {
        return required;
    }

    public String version() {
        return version;
    }

    public static List<ConsentCatalog> activeItems() {
        return Arrays.stream(values()).filter(ConsentCatalog::enabled).toList();
    }

    public static List<ConsentCatalog> requiredActiveItems() {
        return activeItems().stream().filter(ConsentCatalog::required).toList();
    }

    public static ConsentCatalog fromKey(String key) {
        return Arrays.stream(values())
                .filter(item -> item.key.equals(key))
                .findFirst()
                .orElse(null);
    }
}
