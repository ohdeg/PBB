package com.studiobs.spring_backend.domain.sranko.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.studiobs.spring_backend.domain.sranko.service.SrankoFitAnalyzer.Fit;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class SrankoTryOnBatchesTest {

    private record G(String slot) {
    }

    @Test
    void shouldMultiPass_atFour() {
        assertThat(SrankoTryOnBatches.shouldMultiPass(3)).isFalse();
        assertThat(SrankoTryOnBatches.shouldMultiPass(4)).isTrue();
        assertThat(SrankoTryOnBatches.shouldMultiPass(5)).isTrue();
    }

    @Test
    void partition_bodyAccessoriesRest() {
        var batches = SrankoTryOnBatches.partition(
                List.of(new G("OUTER"), new G("TOP"), new G("BOTTOM"), new G("HAT"), new G("SHOES")),
                G::slot
        );
        assertThat(batches.body()).extracting(G::slot).containsExactly("OUTER", "TOP", "BOTTOM");
        assertThat(batches.accessories()).extracting(G::slot).containsExactly("HAT", "SHOES");
        assertThat(batches.rest()).isEmpty();
        assertThat(batches.accessoriesEmpty()).isFalse();
        assertThat(batches.restEmpty()).isTrue();
    }

    @Test
    void partition_emptyAccessories() {
        var batches = SrankoTryOnBatches.partition(
                List.of(new G("TOP"), new G("BOTTOM"), new G("OUTER")),
                G::slot
        );
        assertThat(batches.accessoriesEmpty()).isTrue();
        assertThat(batches.body()).hasSize(3);
    }

    @Test
    void bodyCacheKey_stable() {
        UUID user = UUID.fromString("11111111-1111-1111-1111-111111111111");
        String a = SrankoTryOnBodyCacheService.buildKey(
                user, "default:M", List.of("a@url1", "b@url2"), "regular", "M");
        String b = SrankoTryOnBodyCacheService.buildKey(
                user, "default:M", List.of("a@url1", "b@url2"), "regular", "M");
        String c = SrankoTryOnBodyCacheService.buildKey(
                user, "default:M", List.of("a@url1", "b@url3"), "regular", "M");
        assertThat(a).isEqualTo(b);
        assertThat(a).isNotEqualTo(c);
        assertThat(a).startsWith("sranko:tryon:body:");
    }

    @Test
    void followUpPrompt_keepsPriorOutfit() {
        String prompt = SrankoFitAnalyzer.buildFollowUpTryOnPrompt(
                List.of("HAT", "SHOES"),
                List.of(Fit.REGULAR, Fit.REGULAR),
                Fit.REGULAR,
                false,
                List.of(Map.of(), Map.of())
        );
        assertThat(prompt).containsIgnoringCase("follow-up");
        assertThat(prompt).containsIgnoringCase("ONLY add");
        assertThat(prompt).contains("Image 2: HAT");
        assertThat(prompt).contains("Image 3: SHOES");
        assertThat(prompt).containsIgnoringCase("MALE person");
    }
}
