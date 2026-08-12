package com.studiobs.spring_backend.domain.sranko.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import java.util.UUID;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "sranko_prefs")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class SrankoPrefs {

    @Id
    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(name = "user_id", length = 36, nullable = false)
    private UUID userId;

    @Column(name = "try_on_consent", nullable = false)
    private boolean tryOnConsent;

    /** M or F; null treated as M for default mannequin. */
    @Column(name = "sex", length = 1)
    private String sex;

    @Column(name = "body_measurements_json", nullable = false, columnDefinition = "json")
    private String bodyMeasurementsJson;

    /** Saved places JSON array for weather. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "places_json", nullable = false, columnDefinition = "json")
    private String placesJson;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @Builder
    public SrankoPrefs(
            UUID userId,
            boolean tryOnConsent,
            String sex,
            String bodyMeasurementsJson,
            String placesJson
    ) {
        this.userId = userId;
        this.tryOnConsent = tryOnConsent;
        this.sex = normalizeSex(sex);
        this.bodyMeasurementsJson =
                bodyMeasurementsJson != null && !bodyMeasurementsJson.isBlank()
                        ? bodyMeasurementsJson
                        : "{}";
        this.placesJson =
                placesJson != null && !placesJson.isBlank() ? placesJson : "[]";
    }

    public void patch(
            Boolean tryOnConsent,
            String sex,
            String bodyMeasurementsJson,
            String placesJson
    ) {
        if (tryOnConsent != null) {
            this.tryOnConsent = tryOnConsent;
        }
        if (sex != null) {
            this.sex = normalizeSex(sex);
        }
        if (bodyMeasurementsJson != null) {
            this.bodyMeasurementsJson = bodyMeasurementsJson.isBlank() ? "{}" : bodyMeasurementsJson;
        }
        if (placesJson != null) {
            this.placesJson = placesJson.isBlank() ? "[]" : placesJson;
        }
    }

    /** Female → F; otherwise M (including null/blank). */
    public String resolvedSex() {
        return "F".equalsIgnoreCase(sex) ? "F" : "M";
    }

    private static String normalizeSex(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        String upper = raw.trim().toUpperCase();
        if ("F".equals(upper) || "M".equals(upper)) {
            return upper;
        }
        return null;
    }
}
