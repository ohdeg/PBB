package com.studiobs.spring_backend.domain.sranko.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

import com.studiobs.spring_backend.domain.sranko.service.SrankoFitAnalyzer.Fit;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class SrankoFitAnalyzerTest {

    @Test
    void band_boundaries() {
        assertThat(SrankoFitAnalyzer.band(-2.0)).isEqualTo(Fit.SLIM);
        assertThat(SrankoFitAnalyzer.band(-2.1)).isEqualTo(Fit.SLIM);
        assertThat(SrankoFitAnalyzer.band(-1.9)).isEqualTo(Fit.REGULAR);
        assertThat(SrankoFitAnalyzer.band(4.0)).isEqualTo(Fit.REGULAR);
        assertThat(SrankoFitAnalyzer.band(4.1)).isEqualTo(Fit.LOOSE);
    }

    @Test
    void muchTooSmall_threshold() {
        assertThat(SrankoFitAnalyzer.muchTooSmall(-5.0)).isTrue();
        assertThat(SrankoFitAnalyzer.muchTooSmall(-4.0)).isTrue();
        assertThat(SrankoFitAnalyzer.muchTooSmall(-3.0)).isFalse();
        assertThat(SrankoFitAnalyzer.muchTooSmall(-2.0)).isFalse();
    }

    @Test
    void horizontalScale_clampsAndUsesAlpha() {
        // Δ=-5, body=100 → 1 + 0.85*(-0.05) = 0.9575
        assertThat(SrankoFitAnalyzer.horizontalScale(100, -5.0)).isCloseTo(0.9575, within(1e-9));
        // Δ=+20, body=100 → 1.15 would be 1.15 raw → clamp SCALE_MAX
        assertThat(SrankoFitAnalyzer.horizontalScale(100, 40.0)).isEqualTo(SrankoFitAnalyzer.SCALE_MAX);
        // Δ=-50, body=100 → 0.575 → clamp SCALE_MIN
        assertThat(SrankoFitAnalyzer.horizontalScale(100, -50.0)).isEqualTo(SrankoFitAnalyzer.SCALE_MIN);
        assertThat(SrankoFitAnalyzer.horizontalScale(0, -5.0)).isEqualTo(1.0);
    }

    @Test
    void verticalScale_mildFollow() {
        assertThat(SrankoFitAnalyzer.verticalScale(1.08))
                .isCloseTo(1.0 + 0.25 * 0.08, within(1e-9));
        assertThat(SrankoFitAnalyzer.verticalScale(1.0)).isEqualTo(1.0);
    }

    @Test
    void top_deltaMinus5_slimAndMuchTooSmall_noInwardWarp() {
        var result = SrankoFitAnalyzer.analyze(
                "TOP",
                Map.of("chest", "100"),
                Map.of("chest", "95")
        );
        assertThat(result.fit()).isEqualTo(Fit.SLIM);
        assertThat(result.muchTooSmall()).isTrue();
        assertThat(result.primaryKey()).isEqualTo("chest");
        assertThat(result.primaryDeltaCm()).isEqualTo(-5.0);
        assertThat(result.primaryBodyCm()).isEqualTo(100.0);
        // Inward warp disabled for slim: tightness is rendered by Stage2 only.
        assertThat(result.skipWarp()).isTrue();
        assertThat(result.scaleX()).isEqualTo(1.0);
        assertThat(result.scaleY()).isEqualTo(1.0);
        assertThat(result.skipStage2()).isFalse();
    }

    @Test
    void top_deltaMinus3_slimButNotMuchTooSmall() {
        var result = SrankoFitAnalyzer.analyze(
                "TOP",
                Map.of("chest", "100"),
                Map.of("chest", "97")
        );
        assertThat(result.fit()).isEqualTo(Fit.SLIM);
        assertThat(result.muchTooSmall()).isFalse();
        assertThat(result.skipWarp()).isTrue();
        assertThat(result.scaleX()).isEqualTo(1.0);
        assertThat(result.skipStage2()).isFalse();
    }

    @Test
    void top_usesChestPrimary_slim() {
        var result = SrankoFitAnalyzer.analyze(
                "TOP",
                Map.of("chest", "100", "shoulder", "45"),
                Map.of("chest", "97", "shoulder", "44")
        );
        assertThat(result.fit()).isEqualTo(Fit.SLIM);
        assertThat(result.skipStage2()).isFalse();
        assertThat(result.skipWarp()).isTrue();
        assertThat(result.scaleX()).isEqualTo(1.0);
        assertThat(result.scaleY()).isEqualTo(1.0);
        assertThat(result.muchTooSmall()).isFalse();
        assertThat(result.promptEnglish()).containsIgnoringCase("slim");
        assertThat(result.promptEnglish()).contains("Δ=");
        assertThat(result.promptEnglish()).contains("100.0");
        assertThat(result.promptEnglish()).contains("band: slim");
        assertThat(result.promptEnglish()).containsIgnoringCase("body size");
        assertThat(result.promptEnglish()).containsIgnoringCase("tension wrinkles");
        assertThat(result.promptEnglish()).containsIgnoringCase("crop");
        assertThat(result.promptEnglish()).containsIgnoringCase("Image 2");
        assertThat(result.primaryBodyCm()).isEqualTo(100.0);
    }

    @Test
    void top_looseWhenGarmentMuchLarger() {
        var result = SrankoFitAnalyzer.analyze(
                "OUTER",
                Map.of("chest", "90"),
                Map.of("chest", "100")
        );
        assertThat(result.fit()).isEqualTo(Fit.LOOSE);
        assertThat(result.promptEnglish()).containsIgnoringCase("loose");
        assertThat(result.promptEnglish()).contains("Δ=");
        assertThat(result.promptEnglish()).contains("90.0");
        assertThat(result.skipWarp()).isFalse();
        assertThat(result.skipStage2()).isFalse();
        assertThat(result.scaleX()).isGreaterThan(1.0);
    }

    @Test
    void regular_smallDelta_skipsWarpAndStage2() {
        var result = SrankoFitAnalyzer.analyze(
                "TOP",
                Map.of("chest", "100"),
                Map.of("chest", "100.5")
        );
        assertThat(result.fit()).isEqualTo(Fit.REGULAR);
        assertThat(result.skipWarp()).isTrue();
        assertThat(result.skipStage2()).isTrue();
        assertThat(result.scaleX()).isEqualTo(1.0);
        assertThat(result.scaleY()).isEqualTo(1.0);
        assertThat(result.promptEnglish()).contains("band: regular");
    }

    @Test
    void bottom_mapsThighCircumferenceToThigh() {
        var result = SrankoFitAnalyzer.analyze(
                "BOTTOM",
                Map.of("waist", "80", "thighCircumference", "55"),
                Map.of("waist", "82", "thigh", "56")
        );
        assertThat(result.fit()).isEqualTo(Fit.REGULAR);
        // waist primary Δ=+2 → not tiny → warp may run
        assertThat(result.skipWarp()).isFalse();
        assertThat(result.skipStage2()).isFalse();
        assertThat(result.primaryBodyCm()).isEqualTo(80.0);
    }

    @Test
    void dress_missingShoulderStillAveragesChestAndWaist() {
        // chest delta +10, waist delta -4 → avg +3 → regular
        var result = SrankoFitAnalyzer.analyze(
                "DRESS",
                Map.of("chest", "90", "waist", "70"),
                Map.of("chest", "100", "waist", "66")
        );
        assertThat(result.fit()).isEqualTo(Fit.REGULAR);
        assertThat(result.primaryDeltaCm()).isCloseTo(3.0, within(1e-9));
        assertThat(result.skipWarp()).isFalse();
        assertThat(result.skipStage2()).isFalse();
    }

    @Test
    void dress_includesShoulderInOverallAverage() {
        // shoulder delta -6, chest delta +3, waist delta +3 → avg 0 → regular
        var result = SrankoFitAnalyzer.analyze(
                "DRESS",
                Map.of("shoulder", "42", "chest", "90", "waist", "70"),
                Map.of("shoulder", "36", "chest", "93", "waist", "73")
        );
        assertThat(result.fit()).isEqualTo(Fit.REGULAR);
        assertThat(result.primaryKey()).isEqualTo("shoulder");
        assertThat(result.primaryDeltaCm()).isCloseTo(0.0, within(1e-9));
        assertThat(result.primaryBodyCm()).isCloseTo(202.0 / 3.0, within(1e-9));
    }

    @Test
    void dress_excludesArmLengthFromOverallAverage() {
        // shoulder/chest/waist Δ=+3; short sleeve Δ would be huge negative if included.
        var result = SrankoFitAnalyzer.analyze(
                "DRESS",
                Map.of("shoulder", "42", "chest", "90", "armLength", "60", "waist", "70"),
                Map.of("shoulder", "45", "chest", "93", "armLength", "25", "waist", "73")
        );
        assertThat(result.fit()).isEqualTo(Fit.REGULAR);
        assertThat(result.primaryKey()).isNotEqualTo("armLength");
        assertThat(result.primaryDeltaCm()).isCloseTo(3.0, within(1e-9));
        assertThat(result.primaryBodyCm()).isCloseTo(202.0 / 3.0, within(1e-9));
    }

    @Test
    void dress_missingArmLength_keepsLegacyAverage() {
        // Legacy DRESS item has no armLength: shoulder/chest/waist still average normally.
        var result = SrankoFitAnalyzer.analyze(
                "DRESS",
                Map.of("shoulder", "42", "chest", "90", "armLength", "60", "waist", "70"),
                Map.of("shoulder", "36", "chest", "93", "waist", "73")
        );
        assertThat(result.fit()).isEqualTo(Fit.REGULAR);
        assertThat(result.primaryKey()).isEqualTo("shoulder");
        assertThat(result.primaryDeltaCm()).isCloseTo(0.0, within(1e-9));
        assertThat(result.primaryBodyCm()).isCloseTo(202.0 / 3.0, within(1e-9));
    }

    @Test
    void missingMeasurements_defaultsRegularAndSkipsWarpAndStage2() {
        var result = SrankoFitAnalyzer.analyze("TOP", Map.of(), Map.of("chest", "96"));
        assertThat(result.fit()).isEqualTo(Fit.REGULAR);
        assertThat(result.skipStage2()).isTrue();
        assertThat(result.skipWarp()).isTrue();
        assertThat(result.primaryDeltaCm()).isNull();
        assertThat(result.promptEnglish()).isNotNull();
        assertThat(result.promptEnglish()).containsIgnoringCase("appearance only");
        assertThat(result.promptEnglish()).containsIgnoringCase("crop");
    }

    @Test
    void shoes_skipStage2AndSkipWarp() {
        var result = SrankoFitAnalyzer.analyze(
                "SHOES",
                Map.of("shoeSize", "260"),
                Map.of("shoeSize", "265")
        );
        assertThat(result.fit()).isEqualTo(Fit.REGULAR);
        assertThat(result.skipStage2()).isTrue();
        assertThat(result.skipWarp()).isTrue();
        assertThat(result.muchTooSmall()).isFalse();
        assertThat(result.promptEnglish()).isNull();
    }

    @Test
    void fallsBackToShoulderWhenChestMissing() {
        // shoulder garment 40 − body 44 = -4 → slim + muchTooSmall
        var result = SrankoFitAnalyzer.analyze(
                "TOP",
                Map.of("shoulder", "44"),
                Map.of("shoulder", "40")
        );
        assertThat(result.fit()).isEqualTo(Fit.SLIM);
        assertThat(result.muchTooSmall()).isTrue();
        assertThat(result.primaryBodyCm()).isEqualTo(44.0);
        assertThat(result.skipWarp()).isTrue();
        assertThat(result.skipStage2()).isFalse();
    }

    @Test
    void buildPrompt_embedsDeltaBodyBandAndPreserve() {
        String prompt = SrankoFitAnalyzer.buildPrompt(Fit.SLIM, -5.0, 100.0, "TOP");
        assertThat(prompt).isNotNull();
        assertThat(prompt).contains("band: slim");
        assertThat(prompt).contains("Δ=-5.0 cm");
        assertThat(prompt).contains("100.0 cm");
        assertThat(prompt).contains("Garment slot: TOP");
        assertThat(prompt).containsIgnoringCase("slim");
        assertThat(prompt).containsIgnoringCase("body size");
        assertThat(prompt).containsIgnoringCase("tension wrinkles");
        assertThat(prompt).containsIgnoringCase("crop");
        assertThat(prompt).containsIgnoringCase("midriff");
        assertThat(prompt).containsIgnoringCase("underbust");
        assertThat(prompt).containsIgnoringCase("Image 1");
        assertThat(prompt).containsIgnoringCase("Image 2");
        assertThat(prompt).containsIgnoringCase("ABSOLUTE BASE");
        assertThat(prompt).containsIgnoringCase("DO NOT ignore");
        assertThat(prompt).containsIgnoringCase("new model");
        assertThat(prompt).containsIgnoringCase("solid black");
        assertThat(prompt).containsIgnoringCase("ghost-mannequin");
        assertThat(prompt).containsIgnoringCase("REMOVE");
        assertThat(prompt).containsIgnoringCase("REPLACE");
        assertThat(prompt).containsIgnoringCase("do NOT layer");
        assertThat(prompt).containsIgnoringCase("Face lock");
        assertThat(prompt).containsIgnoringCase("head-to-toe");
        assertThat(prompt).containsIgnoringCase("fully visible");
        assertThat(prompt).containsIgnoringCase("PERSON SEX");
        assertThat(prompt).containsIgnoringCase("MALE person");
        assertThat(prompt).containsIgnoringCase("30°");
        assertThat(prompt).containsIgnoringCase("camera-left");
        assertThat(prompt).containsIgnoringCase("beautify");
        assertThat(prompt).containsIgnoringCase("ethnicity");
    }

    @Test
    void buildTryOnPrompt_femaleSexClause() {
        String prompt = SrankoFitAnalyzer.buildTryOnPrompt(
                Fit.REGULAR,
                null,
                null,
                "TOP",
                true,
                Map.of(),
                "F"
        );
        assertThat(prompt).containsIgnoringCase("PERSON SEX");
        assertThat(prompt).containsIgnoringCase("FEMALE person/mannequin");
        assertThat(prompt).containsIgnoringCase("Do NOT masculinize");
    }

    @Test
    void buildMultiTryOnPrompt_listsSlotsAndLayering() {
        String prompt = SrankoFitAnalyzer.buildMultiTryOnPrompt(
                List.of("TOP", "BOTTOM"),
                Fit.REGULAR,
                false
        );
        assertThat(prompt).containsIgnoringCase("lookbook");
        assertThat(prompt).contains("Image 2: TOP");
        assertThat(prompt).contains("Image 3: BOTTOM");
        assertThat(prompt).containsIgnoringCase("OUTER over TOP");
        assertThat(prompt).containsIgnoringCase("regular");
        assertThat(prompt).containsIgnoringCase("REMOVE");
        assertThat(prompt).containsIgnoringCase("REPLACE");
        assertThat(prompt).containsIgnoringCase("Do NOT stack");
    }

    @Test
    void buildMultiTryOnPrompt_perGarmentFits() {
        String prompt = SrankoFitAnalyzer.buildMultiTryOnPrompt(
                List.of("TOP", "BOTTOM"),
                List.of(Fit.SLIM, Fit.LOOSE),
                Fit.SLIM,
                false
        );
        assertThat(prompt).contains("Image 2: TOP (slim fit)");
        assertThat(prompt).contains("Image 3: BOTTOM (loose fit)");
        assertThat(prompt).containsIgnoringCase("FIT key");
        assertThat(prompt).containsIgnoringCase("independently");
        assertThat(prompt).doesNotContain("FIT for Image 2 (TOP)");
        assertThat(prompt).doesNotContain("FIT for Image 3 (BOTTOM)");
    }

    @Test
    void buildTryOnPrompt_includesGarmentSizesWithoutBody() {
        String prompt = SrankoFitAnalyzer.buildTryOnPrompt(
                Fit.REGULAR,
                null,
                null,
                "TOP",
                false,
                Map.of("chest", "96", "shoulder", "44", "totalLength", "68")
        );
        assertThat(prompt).contains("Garment sizes (product label measurements):");
        assertThat(prompt).contains("Image 2 (TOP):");
        assertThat(prompt).contains("chest 96.0 cm");
        assertThat(prompt).contains("shoulder 44.0 cm");
        assertThat(prompt).contains("totalLength 68.0 cm");
        assertThat(prompt).containsIgnoringCase("absolute sizes");
        assertThat(prompt).doesNotContain("Δ=");
    }

    @Test
    void buildMultiTryOnPrompt_includesPerGarmentSizes() {
        String prompt = SrankoFitAnalyzer.buildMultiTryOnPrompt(
                List.of("TOP", "BOTTOM"),
                List.of(Fit.REGULAR, Fit.REGULAR),
                Fit.REGULAR,
                false,
                List.of(
                        Map.of("chest", "98"),
                        Map.of("waist", "80", "totalLength", "100")
                )
        );
        assertThat(prompt).contains("Garment sizes (product label measurements):");
        assertThat(prompt).contains("Image 2 (TOP): chest 98.0 cm");
        assertThat(prompt).contains("Image 3 (BOTTOM): totalLength 100.0 cm, waist 80.0 cm");
    }

    @Test
    void appendGarmentSizeFacts_emptyMaps_omitsBlock() {
        String prompt = SrankoFitAnalyzer.buildTryOnPrompt(
                Fit.REGULAR,
                null,
                null,
                "TOP",
                false,
                Map.of()
        );
        assertThat(prompt).doesNotContain("Garment sizes");
    }

    @Test
    void formatGarmentSizeLine_shoeUsesMm() {
        assertThat(SrankoFitAnalyzer.formatGarmentSizeLine(Map.of("shoeSize", "260")))
                .isEqualTo("shoeSize 260 mm");
    }

    @Test
    void aggregateFit_slimWins() {
        assertThat(SrankoFitAnalyzer.aggregateFit(List.of(Fit.REGULAR, Fit.SLIM, Fit.LOOSE)))
                .isEqualTo(Fit.SLIM);
        assertThat(SrankoFitAnalyzer.aggregateFit(List.of(Fit.REGULAR, Fit.LOOSE)))
                .isEqualTo(Fit.LOOSE);
        assertThat(SrankoFitAnalyzer.aggregateFit(List.of(Fit.REGULAR)))
                .isEqualTo(Fit.REGULAR);
    }

    @Test
    void buildPrompt_extremeDeltaCapped_omitsRawNumber() {
        // |Δ|=35.7 > 20% of 120.7 (=24.14) → raw Δ suppressed, generic extreme sentence instead.
        String prompt = SrankoFitAnalyzer.buildPrompt(Fit.SLIM, -35.7, 120.7, "TOP");
        assertThat(prompt).isNotNull();
        assertThat(prompt).doesNotContain("Δ=");
        assertThat(prompt).contains("much too small");
        assertThat(prompt).contains("band: slim");
        assertThat(prompt).containsIgnoringCase("tension wrinkles");
    }

    @Test
    void buildPrompt_withinCap_keepsFormattedDelta() {
        // |Δ|=9.1 < 20% of 120.7 → formatted Δ embedded as before.
        String prompt = SrankoFitAnalyzer.buildPrompt(Fit.SLIM, -9.1, 120.7, "TOP");
        assertThat(prompt).isNotNull();
        assertThat(prompt).contains("Δ=-9.1 cm");
        assertThat(prompt).contains("120.7 cm");
        assertThat(prompt).doesNotContain("much too small");
    }

    @Test
    void buildPrompt_muchTooSmallWithinCap_addsStrongerTensionSentence() {
        String prompt = SrankoFitAnalyzer.buildPrompt(Fit.SLIM, -9.1, 120.7, "TOP");
        assertThat(prompt).containsIgnoringCase("pronounced stretch wrinkles");
        assertThat(prompt).containsIgnoringCase("visibly strained");
        // Not muchTooSmall (Δ=-3) → no extra tension sentence.
        String mild = SrankoFitAnalyzer.buildPrompt(Fit.SLIM, -3.0, 100.0, "TOP");
        assertThat(mild).doesNotContainIgnoringCase("pronounced stretch wrinkles");
    }

    @Test
    void buildPrompt_looseIncludesPositiveDelta() {
        String prompt = SrankoFitAnalyzer.buildPrompt(Fit.LOOSE, 10.0, 90.0, "OUTER");
        assertThat(prompt).contains("band: loose");
        assertThat(prompt).contains("Δ=+10.0 cm");
        assertThat(prompt).contains("90.0 cm");
        assertThat(prompt).containsIgnoringCase("loose");
        assertThat(prompt).containsIgnoringCase("body size");
        assertThat(prompt).containsIgnoringCase("Do NOT inflate");
        assertThat(prompt).containsIgnoringCase("roomy");
    }

    @Test
    void buildPrompt_regularPreservesBodySize() {
        String prompt = SrankoFitAnalyzer.buildPrompt(Fit.REGULAR, 2.0, 95.0, "TOP");
        assertThat(prompt).contains("band: regular");
        assertThat(prompt).containsIgnoringCase("body size");
        assertThat(prompt).containsIgnoringCase("crop");
        assertThat(prompt).containsIgnoringCase("neckline");
    }

    @Test
    void buildPrompt_nullWhenMissingMeasurements() {
        assertThat(SrankoFitAnalyzer.buildPrompt(Fit.REGULAR, null, 100.0, "TOP")).isNull();
        assertThat(SrankoFitAnalyzer.buildPrompt(Fit.REGULAR, 1.0, null, "TOP")).isNull();
        assertThat(SrankoFitAnalyzer.buildPrompt(Fit.REGULAR, 1.0, 0.0, "TOP")).isNull();
    }

    @Test
    void partComparisons_top_allPartsAndBands() {
        var parts = SrankoFitAnalyzer.partComparisons(
                "TOP",
                "긴팔",
                Map.of("shoulder", "45", "chest", "100", "armLength", "60", "torsoLength", "65"),
                Map.of("shoulder", "46", "chest", "95", "armLength", "66", "totalLength", "68")
        );
        assertThat(parts).extracting(SrankoFitAnalyzer.PartComparison::key)
                .containsExactly("shoulder", "chest", "armLength", "totalLength");
        // shoulder Δ=+1 → OK
        assertThat(parts.get(0).deltaCm()).isEqualTo(1.0);
        assertThat(parts.get(0).band()).isEqualTo(SrankoFitAnalyzer.PartBand.OK);
        // chest Δ=−5 → SMALL
        assertThat(parts.get(1).bodyCm()).isEqualTo(100.0);
        assertThat(parts.get(1).garmentCm()).isEqualTo(95.0);
        assertThat(parts.get(1).deltaCm()).isEqualTo(-5.0);
        assertThat(parts.get(1).band()).isEqualTo(SrankoFitAnalyzer.PartBand.SMALL);
        // long sleeve ratio 66/60=1.10 > 1.05 → Δ=(1.10-1.05)*60=+3 → OK
        assertThat(parts.get(2).deltaCm()).isCloseTo(3.0, within(1e-9));
        assertThat(parts.get(2).band()).isEqualTo(SrankoFitAnalyzer.PartBand.OK);
        // garment totalLength vs body torsoLength Δ=+3 → OK
        assertThat(parts.get(3).deltaCm()).isEqualTo(3.0);
        assertThat(parts.get(3).band()).isEqualTo(SrankoFitAnalyzer.PartBand.OK);
    }

    @Test
    void partComparisons_shortSleeve_inRangeIsOkNotVeryTight() {
        // Raw Δ would be 25−60=−35 (very tight); short-style ratio 0.417 is in 0.30–0.55.
        var parts = SrankoFitAnalyzer.partComparisons(
                "TOP",
                "반팔",
                Map.of("armLength", "60", "chest", "100"),
                Map.of("armLength", "25", "chest", "100")
        );
        assertThat(parts.get(2).key()).isEqualTo("armLength");
        assertThat(parts.get(2).deltaCm()).isEqualTo(0.0);
        assertThat(parts.get(2).band()).isEqualTo(SrankoFitAnalyzer.PartBand.OK);
    }

    @Test
    void partComparisons_shorts_inRangeIsOk() {
        var parts = SrankoFitAnalyzer.partComparisons(
                "BOTTOM",
                "반바지",
                Map.of("waist", "80", "legLength", "100"),
                Map.of("waist", "80", "totalLength", "45")
        );
        assertThat(parts.get(3).key()).isEqualTo("totalLength");
        assertThat(parts.get(3).deltaCm()).isEqualTo(0.0);
        assertThat(parts.get(3).band()).isEqualTo(SrankoFitAnalyzer.PartBand.OK);
    }

    @Test
    void partComparisons_bandBoundaries() {
        assertThat(SrankoFitAnalyzer.partBand(-2.0)).isEqualTo(SrankoFitAnalyzer.PartBand.SMALL);
        assertThat(SrankoFitAnalyzer.partBand(-1.9)).isEqualTo(SrankoFitAnalyzer.PartBand.OK);
        assertThat(SrankoFitAnalyzer.partBand(4.0)).isEqualTo(SrankoFitAnalyzer.PartBand.OK);
        assertThat(SrankoFitAnalyzer.partBand(4.1)).isEqualTo(SrankoFitAnalyzer.PartBand.LARGE);
    }

    @Test
    void partComparisons_missingValues_unknownWithNulls() {
        var parts = SrankoFitAnalyzer.partComparisons(
                "TOP",
                Map.of("chest", "100"),
                Map.of("chest", "99", "shoulder", "46")
        );
        // shoulder: garment present, body missing → UNKNOWN, deltaCm null.
        assertThat(parts.get(0).key()).isEqualTo("shoulder");
        assertThat(parts.get(0).band()).isEqualTo(SrankoFitAnalyzer.PartBand.UNKNOWN);
        assertThat(parts.get(0).bodyCm()).isNull();
        assertThat(parts.get(0).garmentCm()).isEqualTo(46.0);
        assertThat(parts.get(0).deltaCm()).isNull();
        // chest: both present → OK.
        assertThat(parts.get(1).band()).isEqualTo(SrankoFitAnalyzer.PartBand.OK);
        // armLength / totalLength: both sides missing → UNKNOWN.
        assertThat(parts.get(2).band()).isEqualTo(SrankoFitAnalyzer.PartBand.UNKNOWN);
        assertThat(parts.get(3).band()).isEqualTo(SrankoFitAnalyzer.PartBand.UNKNOWN);
    }

    @Test
    void partComparisons_bottom_mapsThighAndLegLength() {
        var parts = SrankoFitAnalyzer.partComparisons(
                "BOTTOM",
                "면바지",
                Map.of("waist", "80", "thighCircumference", "55", "legLength", "100"),
                Map.of("waist", "82", "thigh", "56", "totalLength", "103")
        );
        assertThat(parts).extracting(SrankoFitAnalyzer.PartComparison::key)
                .containsExactly("waist", "hip", "thigh", "totalLength");
        assertThat(parts.get(0).deltaCm()).isEqualTo(2.0);
        assertThat(parts.get(0).band()).isEqualTo(SrankoFitAnalyzer.PartBand.OK);
        assertThat(parts.get(1).band()).isEqualTo(SrankoFitAnalyzer.PartBand.UNKNOWN);
        // garment thigh ↔ body thighCircumference Δ=+1 → OK
        assertThat(parts.get(2).bodyCm()).isEqualTo(55.0);
        assertThat(parts.get(2).deltaCm()).isEqualTo(1.0);
        assertThat(parts.get(2).band()).isEqualTo(SrankoFitAnalyzer.PartBand.OK);
        // long-leg ratio 1.03 in 0.90–1.05 → Δ=0 OK
        assertThat(parts.get(3).bodyCm()).isEqualTo(100.0);
        assertThat(parts.get(3).deltaCm()).isEqualTo(0.0);
        assertThat(parts.get(3).band()).isEqualTo(SrankoFitAnalyzer.PartBand.OK);
    }

    @Test
    void partComparisons_dress_shortSleeveRatio() {
        var parts = SrankoFitAnalyzer.partComparisons(
                "DRESS",
                "반팔",
                Map.of("shoulder", "42", "chest", "90", "armLength", "60", "waist", "70", "hip", "95"),
                Map.of("shoulder", "39", "chest", "100", "armLength", "28", "waist", "66", "hip", "96")
        );
        assertThat(parts).extracting(SrankoFitAnalyzer.PartComparison::key)
                .containsExactly("shoulder", "chest", "armLength", "waist", "hip");
        assertThat(parts.get(0).bodyCm()).isEqualTo(42.0);
        assertThat(parts.get(0).garmentCm()).isEqualTo(39.0);
        assertThat(parts.get(0).deltaCm()).isEqualTo(-3.0);
        assertThat(parts.get(0).band()).isEqualTo(SrankoFitAnalyzer.PartBand.SMALL);
        assertThat(parts.get(1).band()).isEqualTo(SrankoFitAnalyzer.PartBand.LARGE);
        // short sleeve 28/60 ≈ 0.467 in range → OK
        assertThat(parts.get(2).bodyCm()).isEqualTo(60.0);
        assertThat(parts.get(2).garmentCm()).isEqualTo(28.0);
        assertThat(parts.get(2).deltaCm()).isEqualTo(0.0);
        assertThat(parts.get(2).band()).isEqualTo(SrankoFitAnalyzer.PartBand.OK);
        assertThat(parts.get(3).band()).isEqualTo(SrankoFitAnalyzer.PartBand.SMALL);
        assertThat(parts.get(4).band()).isEqualTo(SrankoFitAnalyzer.PartBand.OK);
    }

    @Test
    void partComparisons_shoesAndUnknownSlot_empty() {
        assertThat(SrankoFitAnalyzer.partComparisons(
                "SHOES", Map.of("shoeSize", "260"), Map.of("shoeSize", "265"))).isEmpty();
        assertThat(SrankoFitAnalyzer.partComparisons(
                "HAT", Map.of("chest", "100"), Map.of("chest", "98"))).isEmpty();
        assertThat(SrankoFitAnalyzer.partComparisons(null, null, null)).isEmpty();
    }

    @Test
    void partBand_wireValues() {
        assertThat(SrankoFitAnalyzer.PartBand.SMALL.wireValue()).isEqualTo("small");
        assertThat(SrankoFitAnalyzer.PartBand.OK.wireValue()).isEqualTo("ok");
        assertThat(SrankoFitAnalyzer.PartBand.LARGE.wireValue()).isEqualTo("large");
        assertThat(SrankoFitAnalyzer.PartBand.UNKNOWN.wireValue()).isEqualTo("unknown");
    }
}
