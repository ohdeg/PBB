package com.studiobs.spring_backend.domain.sranko.service;

import com.studiobs.spring_backend.domain.sranko.dto.SrankoPlaceSearchHit;
import jakarta.annotation.PostConstruct;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;

/**
 * Local place catalog for Korean / common aliases → lat/lon (WeatherAPI search is weak on KO).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SrankoPlaceCatalogService {

    private static final String RESOURCE = "sranko/place-catalog.json";
    private static final int MAX_HITS = 8;

    private final ObjectMapper objectMapper;
    private List<CatalogPlace> places = List.of();

    @PostConstruct
    void load() {
        try (InputStream in = new ClassPathResource(RESOURCE).getInputStream()) {
            List<CatalogPlace> loaded = objectMapper.readValue(in, new TypeReference<>() {});
            places = loaded != null ? List.copyOf(loaded) : List.of();
            log.info("[SrankoPlaceCatalog] loaded {} places from {}", places.size(), RESOURCE);
        } catch (Exception ex) {
            places = List.of();
            log.warn("[SrankoPlaceCatalog] failed to load {}: {}", RESOURCE, ex.getMessage());
        }
    }

    public List<SrankoPlaceSearchHit> search(String query) {
        String q = query != null ? query.trim() : "";
        if (q.length() < 2 || places.isEmpty()) {
            return List.of();
        }
        String qFold = fold(q);
        boolean queryHasHangul = containsHangul(q);
        List<Scored> scored = new ArrayList<>();
        for (CatalogPlace place : places) {
            int best = 0;
            String matchedAlias = null;
            List<String> aliases = place.aliases() != null ? place.aliases() : List.of();
            for (String alias : aliases) {
                if (alias == null || alias.isBlank()) {
                    continue;
                }
                int s = score(qFold, fold(alias));
                if (s > best) {
                    best = s;
                    matchedAlias = alias;
                }
            }
            int nameScore = score(qFold, fold(place.name()));
            if (nameScore > best) {
                best = nameScore;
                matchedAlias = place.name();
            }
            if (best <= 0) {
                continue;
            }
            String displayName = place.name();
            if (queryHasHangul && matchedAlias != null && containsHangul(matchedAlias)) {
                displayName = matchedAlias;
            }
            scored.add(new Scored(best, new SrankoPlaceSearchHit(
                    displayName,
                    place.region(),
                    place.country(),
                    place.lat(),
                    place.lon()
            )));
        }
        scored.sort(Comparator.comparingInt(Scored::score).reversed()
                .thenComparing(s -> s.hit().name(), String.CASE_INSENSITIVE_ORDER));
        List<SrankoPlaceSearchHit> out = new ArrayList<>();
        for (Scored s : scored) {
            if (out.size() >= MAX_HITS) {
                break;
            }
            if (out.stream().anyMatch(h -> near(h, s.hit()))) {
                continue;
            }
            out.add(s.hit());
        }
        return List.copyOf(out);
    }

    /** Exact &gt; prefix &gt; contains (min lengths to reduce false positives). */
    static int score(String queryFold, String aliasFold) {
        if (queryFold.isEmpty() || aliasFold.isEmpty()) {
            return 0;
        }
        if (aliasFold.equals(queryFold)) {
            return 100;
        }
        if (aliasFold.startsWith(queryFold) && queryFold.length() >= 2) {
            return 80;
        }
        if (queryFold.startsWith(aliasFold) && aliasFold.length() >= 2) {
            return 70;
        }
        if (queryFold.length() >= 2 && aliasFold.contains(queryFold)) {
            if (queryFold.length() <= 2 && aliasFold.length() > queryFold.length() + 2) {
                return 25;
            }
            return 50;
        }
        return 0;
    }

    private static boolean near(SrankoPlaceSearchHit a, SrankoPlaceSearchHit b) {
        return Math.abs(a.lat() - b.lat()) < 0.03 && Math.abs(a.lon() - b.lon()) < 0.03;
    }

    private static String fold(String value) {
        return value.trim().toLowerCase(Locale.ROOT);
    }

    private static boolean containsHangul(String value) {
        for (int i = 0; i < value.length(); i++) {
            char c = value.charAt(i);
            if (c >= 0xAC00 && c <= 0xD7A3) {
                return true;
            }
        }
        return false;
    }

    private record CatalogPlace(
            String name,
            String region,
            String country,
            double lat,
            double lon,
            List<String> aliases
    ) {
    }

    private record Scored(int score, SrankoPlaceSearchHit hit) {
    }
}
