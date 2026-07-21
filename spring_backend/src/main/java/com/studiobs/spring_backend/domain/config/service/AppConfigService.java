package com.studiobs.spring_backend.domain.config.service;

import com.studiobs.spring_backend.domain.config.entity.AppConfig;
import com.studiobs.spring_backend.domain.config.repository.AppConfigRepository;
import java.util.ArrayList;
import java.util.List;
import java.util.Arrays;
import java.util.LinkedHashSet;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AppConfigService {

    public static final String KEY_FEATURED_APP_ID = "featured_app_id";
    public static final String DEFAULT_FEATURED_APP_ID = "analyze-baseball";
    public static final int MAX_FEATURED_APPS = 5;

    private final AppConfigRepository appConfigRepository;

    /** 저장된 CSV 값을 앱 id 리스트로 분해. 비어 있으면 기본 앱 1개를 반환. */
    @Transactional(readOnly = true)
    public List<String> getFeaturedAppIds() {
        String raw = appConfigRepository.findById(KEY_FEATURED_APP_ID)
                .map(AppConfig::getConfigValue)
                .orElse("");

        List<String> ids = Arrays.stream(raw.split(","))
                .map(String::trim)
                .filter(id -> !id.isEmpty())
                .distinct()
                .limit(MAX_FEATURED_APPS)
                .toList();

        return ids.isEmpty() ? List.of(DEFAULT_FEATURED_APP_ID) : ids;
    }

    /** 중복 제거·최대 5개로 정규화한 뒤 CSV로 저장. */
    @Transactional
    public List<String> setFeaturedAppIds(List<String> appIds) {
        List<String> normalized = new ArrayList<>();
        if (appIds != null) {
            LinkedHashSet<String> seen = new LinkedHashSet<>();
            for (String appId : appIds) {
                if (appId == null) {
                    continue;
                }
                String trimmed = appId.trim();
                if (!trimmed.isEmpty() && seen.add(trimmed) && normalized.size() < MAX_FEATURED_APPS) {
                    normalized.add(trimmed);
                }
            }
        }

        String value = String.join(",", normalized);
        AppConfig config = appConfigRepository.findById(KEY_FEATURED_APP_ID)
                .map(existing -> {
                    existing.updateValue(value);
                    return existing;
                })
                .orElseGet(() -> new AppConfig(KEY_FEATURED_APP_ID, value));

        appConfigRepository.save(config);
        return getFeaturedAppIds();
    }
}
