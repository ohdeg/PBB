package com.studiobs.spring_backend.domain.sranko.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Vertex Gemini single-call try-on settings.
 * When {@link #isLiveConfigured()} is false,
 * {@link com.studiobs.spring_backend.domain.sranko.client.VertexGeminiTryOnClient} uses a stub.
 * Live mode uses Application Default Credentials (ADC).
 * Model: {@link #tryOnModel()} from {@code model}, falling back to legacy {@code fit-model}.
 */
@ConfigurationProperties(prefix = "sranko.vertex")
public record SrankoVertexProperties(
        boolean enabled,
        String projectId,
        String location,
        String model,
        /** Legacy Stage2 flag — unused by single-call try-on. */
        boolean fitEnabled,
        /** Legacy fallback model name when {@code model} is still virtual-try-on-001. */
        String fitModel
) {
    public SrankoVertexProperties {
        if (location == null || location.isBlank()) {
            location = "us-central1";
        }
        if (model == null || model.isBlank()) {
            model = "gemini-2.5-flash-image";
        }
        if (projectId == null) {
            projectId = "";
        }
        if (fitModel == null || fitModel.isBlank()) {
            fitModel = "gemini-2.5-flash-image";
        }
    }

    public boolean isLiveConfigured() {
        return enabled && projectId != null && !projectId.isBlank();
    }

    /**
     * Gemini image model for try-on. Prefer {@code SRANKO_VERTEX_MODEL}; if it still points at
     * legacy {@code virtual-try-on-001}, use {@code fit-model} instead.
     */
    public String tryOnModel() {
        String primary = model != null ? model.trim() : "";
        if (!primary.isBlank() && !primary.toLowerCase().contains("virtual-try-on")) {
            return primary;
        }
        String fallback = fitModel != null ? fitModel.trim() : "";
        return !fallback.isBlank() ? fallback : "gemini-2.5-flash-image";
    }
}
