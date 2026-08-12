package com.studiobs.spring_backend.domain.sranko.service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Garment-vs-body fit label and deterministic 2D warp scales from measurement maps (cm).
 * Keys align with FE {@code measurements.ts} and prefs whitelist in {@link SrankoService}.
 */
public final class SrankoFitAnalyzer {

    /** garment − body (cm) at or below this → severe undersize warning ({@link FitResult#muchTooSmall()}). */
    public static final double MUCH_TOO_SMALL_CM = -4.0;

    /**
     * Horizontal scale gain: {@code sx = 1 + α · (Δ / bodyCm)}.
     * Mild bump after garment-only warp mask (was 0.75); keep conservative so
     * residual mask bleed cannot over-shrink limbs.
     */
    public static final double SCALE_ALPHA = 0.85;

    public static final double SCALE_MIN = 0.88;
    public static final double SCALE_MAX = 1.15;

    /** Mild vertical follow of horizontal scale. */
    public static final double VERTICAL_FOLLOW = 0.25;

    /** REGULAR with |Δ| below this → skip warp (scale≈1). */
    public static final double SKIP_WARP_ABS_DELTA_CM = 1.0;

    public enum Fit {
        SLIM,
        REGULAR,
        LOOSE;

        public String wireValue() {
            return name().toLowerCase(Locale.ROOT);
        }
    }

    /** Per-part fit band for the FE fit-map (same thresholds as {@link #band(double)}). */
    public enum PartBand {
        SMALL,
        OK,
        LARGE,
        UNKNOWN;

        public String wireValue() {
            return name().toLowerCase(Locale.ROOT);
        }
    }

    /**
     * One garment-vs-body comparison for the fit-map. Values are null (band UNKNOWN)
     * when either side is missing or unparsable, so the FE can gray the part out.
     */
    public record PartComparison(
            String key,
            Double bodyCm,
            Double garmentCm,
            Double deltaCm,
            PartBand band
    ) {
    }

    /**
     * @param skipStage2 true when Gemini Stage2 fit edit should not run (SHOES, missing primary,
     *                   REGULAR with |Δ|&lt;{@link #SKIP_WARP_ABS_DELTA_CM}); stays false for SLIM,
     *                   which relies on the Stage2 tension prompt instead of warp
     * @param skipWarp   true when 2D fit-warp should not run (shoes, tiny Δ, missing primary,
     *                   or any inward scale — scaleX&lt;1 would shrink the body, so tightness is
     *                   rendered by Stage2 only)
     * @param scaleX     horizontal warp scale (1.0 when skipped)
     * @param scaleY     vertical warp scale (≈1 when skipped)
     */
    public record FitResult(
            Fit fit,
            String promptEnglish,
            boolean skipStage2,
            boolean muchTooSmall,
            /** Measurement key used for primary Δ (e.g. chest, waist); null when unavailable. */
            String primaryKey,
            Double primaryDeltaCm,
            Double primaryBodyCm,
            boolean skipWarp,
            double scaleX,
            double scaleY
    ) {
    }

    static final String CLAUSE_TASK =
            "Task: Virtual try-on. Dress the person in Image 1 with the garment from Image 2. "
                    + "Produce one realistic photo of the person wearing that exact garment. "
                    + "IMPORTANT: Fully REMOVE any clothing already on Image 1 that covers the same "
                    + "body region as Image 2 (e.g. existing top for TOP, pants for BOTTOM, jacket for "
                    + "OUTER, dress for DRESS, hat for HAT, shoes for SHOES). REPLACE it—do NOT layer "
                    + "the new garment on top of the old one, and do not leave the old garment visible "
                    + "underneath, through, or around the new one. "
                    + "Edit clothing fit/drape only as instructed; do not change identity or garment design. "
                    + "Brand logos, printed graphics, and any text on the garment must stay readable and "
                    + "unchanged—never redraw, paraphrase, or invent lettering.";

    static final String CLAUSE_TASK_MULTI =
            "Task: Virtual try-on lookbook. Dress the person in Image 1 with ALL garments from "
                    + "Images 2 onward as one coherent worn outfit in a single photo. "
                    + "IMPORTANT: For each provided garment, fully REMOVE any clothing already on "
                    + "Image 1 that occupies that same body region, then REPLACE it with the product. "
                    + "Do NOT stack new clothes on top of what the person is already wearing; no old "
                    + "tops/bottoms/outerwear/dress/hat/shoes may remain visible under or through the "
                    + "new items. "
                    + "Layer correctly among the NEW garments only: OUTER over TOP; TOP with BOTTOM; "
                    + "DRESS replaces TOP and BOTTOM; HAT sits on the head above hair; SHOES on the feet. "
                    + "Do not invent extra garments. Match each product image's design and coverage exactly. "
                    + "When many garments are composed together, still preserve every logo and printed "
                    + "word exactly—do not smear, invent, or replace text to finish the outfit.";

    /**
     * Follow-up pass: Image 1 already wears a prior outfit; only add the new garment images.
     */
    static final String CLAUSE_TASK_FOLLOW_UP =
            "Task: Virtual try-on follow-up. Image 1 already shows the person wearing a completed "
                    + "torso/outfit from a previous step. "
                    + "ONLY add or replace the garments from Images 2 onward on the matching body regions "
                    + "(HAT on the head, SHOES on the feet, etc.). "
                    + "Do NOT change, remove, restyle, or re-layer clothing already visible on Image 1 "
                    + "for regions not covered by the new garments. "
                    + "Keep face, identity, hair (except under a new hat), skin, pose, camera angle, "
                    + "background, and existing torso/leg garments 100% unchanged. "
                    + "Fully REMOVE any previous hat/shoes only when replacing that same region. "
                    + "Match each new product image's design exactly; preserve logos/text on new items.";


    /**
     * Immediately after Task: lock Image 1 as the immutable base (anti model-swap).
     */
    static final String CLAUSE_PROCESSING_BASE =
            "CRITICAL PROCESSING RULE:\n"
                    + "- USE IMAGE 1 AS THE ABSOLUTE BASE LAYER. Do NOT replace, regenerate, or alter "
                    + "the person, pose, face, or background. Only composite the new garments onto "
                    + "this fixed base.\n"
                    + "- The output person MUST be the SAME individual as Image 1 — same face geometry, "
                    + "eyes, nose, mouth, jawline, age, skin tone, and hairline. Do NOT beautify, "
                    + "age-shift, gender-shift, change ethnicity, or swap to a different model.\n"
                    + "- Preserve Image 1's exact background color and lighting (usually a light/white "
                    + "studio). DO NOT use a solid black, void, cutout, or fashion-catalog backdrop.\n"
                    + "- If Image 1 has a light background, the output background MUST stay light.";

    /**
     * Shared garment-coverage instructions for single-call Gemini try-on.
     * Product image is the source of truth for length / cutouts / exposure.
     */
    static final String CLAUSE_GARMENT_COVERAGE =
            "CRITICAL garment fidelity (match product image(s) exactly):\n"
                    + "- Preserve each garment's exact design: color, pattern, logos, printed graphics, "
                    + "fabric, sleeve style, neckline shape and depth, hem length, crop length, slits, "
                    + "cutouts, and how much skin is visible.\n"
                    + "- If a product is a short crop top, the hem MUST end above the navel/waistline with "
                    + "midriff clearly exposed. DO NOT lengthen the shirt down to the pants/waistband. "
                    + "Preserve bare stomach skin between shirt hem and bottoms; add natural folds/shadows "
                    + "at the cropped hem.\n"
                    + "- If a product shows underbust / underboob cutouts or midriff windows, KEEP those "
                    + "openings. Do NOT fill them with fabric or convert the look into a modest ordinary top.\n"
                    + "- If a product is full-length (not cropped), do NOT invent a crop or midriff; keep "
                    + "the original hem position.\n"
                    + "- Do NOT rewrite the outfit into a more modest or generic garment.";

    /**
     * Extra emphasis: logos/text degrade first when many garment images are composed.
     */
    static final String CLAUSE_LOGO_TEXT =
            "CRITICAL logos / prints / text (highest priority after person identity):\n"
                    + "- Copy brand marks, emblems, badges, and any lettering from each product image "
                    + "as-is: same spelling, alphabet, language, font style, color, size, and placement "
                    + "on the garment.\n"
                    + "- Do NOT regenerate text with a similar look. Do NOT translate, autocorrect, "
                    + "abbreviate, or replace logos with blank patches or generic symbols.\n"
                    + "- Prefer slight fabric wrinkle over distorting or wiping a logo. If space is tight "
                    + "when layering many items, keep logos intact even if other soft folds adjust.\n"
                    + "- Chest/back/sleeve prints must remain sharp and legible in the final photo.\n"
                    + "STRICT LOGO ISOLATION & NO-HALLUCINATION RULES:\n"
                    + "- DO NOT copy, bleed, or transfer logos, graphics, or text from one garment to "
                    + "another (e.g., do NOT place a logo from Image 3 onto Image 4 or Image 2).\n"
                    + "- IF A PRODUCT HAS NO LOGO (PLAIN): Render that garment strictly PLAIN. Absolutely "
                    + "DO NOT invent, generate, or add any brand mark, symbol, text, or patch to plain "
                    + "garments.\n"
                    + "- Maintain isolation between items: Each item must feature ONLY the design element "
                    + "shown in its own source image.";

    static final String CLAUSE_OUTPUT_FRAME =
            "OUTPUT framing (required):\n"
                    + "- Produce a single full-body portrait photo in vertical 3:4 aspect ratio "
                    + "(taller than wide; width:height = 3:4).\n"
                    + "- Keep the person centered; do not output landscape / wide crops.\n"
                    + "- The entire person MUST be fully visible head-to-toe (crown of head through "
                    + "feet/shoes); no cut-off head, hands, or feet; no tight crop or "
                    + "upper-body-only framing.\n"
                    + "- Leave modest margin around the person so nothing is clipped by the frame edge.\n"
                    + "- Pose: body and face turned about 30° toward camera-left (viewer's left), "
                    + "three-quarter view; not straight-on to camera; not full profile.";

    static final String CLAUSE_PERSON =
            "CRITICAL person fidelity (match Image 1):\n"
                    + "- DO NOT ignore, replace, or regenerate the person in Image 1.\n"
                    + "- DO NOT generate a new model or use a different background.\n"
                    + "- DO NOT switch to a black studio, empty void, or ghost-mannequin catalog look.\n"
                    + "- Keep the person's face, identity, hair, skin tone, and background 100% "
                    + "unchanged from Image 1.\n"
                    + "- Keep body shape, body size, proportions, and limb thickness identical.\n"
                    + "- Pose: match Image 1 body stance as closely as possible, but yaw the body and "
                    + "face about 30° toward camera-left (viewer's left) for a three-quarter view "
                    + "(not straight-on, not profile). Keep camera distance/height similar.\n"
                    + "- Face lock: preserve facial landmarks and face pixels from Image 1 "
                    + "(eye spacing, brow, nose, lips, cheeks, chin). No makeup restyle, no skin "
                    + "smoothing that changes identity, no different hairstyle except where a new "
                    + "HAT must sit.\n"
                    + "- If clothing edits conflict with identity, prefer keeping the face/identity.";

    /**
     * Positive sex lock for Image 1. {@code F} → female; anything else (incl. null) → male
     * (matches {@code SrankoPrefs#resolvedSex()}).
     */
    static String sexClause(String sex) {
        if ("F".equalsIgnoreCase(sex != null ? sex.trim() : "")) {
            return "PERSON SEX (required):\n"
                    + "- Image 1 is a FEMALE person/mannequin. The output MUST remain clearly female "
                    + "(female body proportions). Do NOT masculinize or swap to a male model.";
        }
        return "PERSON SEX (required):\n"
                + "- Image 1 is a MALE person/mannequin. The output MUST remain clearly male "
                + "(male body proportions). Do NOT feminize or swap to a female model.";
    }

    static final String FIT_SLIM =
            "FIT slim/too-small: show tight fabric (tension wrinkles, taut seams); do not shrink the body "
                    + "or change neckline/coverage.";

    static final String FIT_REGULAR =
            "FIT regular: natural ease and drape—neither clinging nor oversized; keep cut/hem/coverage.";

    static final String FIT_LOOSE =
            "FIT loose/oversized: add roomy drape away from torso/limbs; do not inflate the body or "
                    + "close cutouts.";

    /** One-line legend for multi-garment prompts (definitions once, labels per image). */
    static final String FIT_LEGEND =
            "FIT key — slim: tight/strained fabric; regular: natural ease; loose: roomy drape. "
                    + "Never change body size; apply the fit named on each garment image independently.";

    private SrankoFitAnalyzer() {
    }

    /** True when primary garment−body delta is ≤ {@link #MUCH_TOO_SMALL_CM}. */
    public static boolean muchTooSmall(double delta) {
        return delta <= MUCH_TOO_SMALL_CM;
    }

    /**
     * Horizontal scale from body circumference and garment−body delta (cm).
     * Clamped to [{@link #SCALE_MIN}, {@link #SCALE_MAX}].
     */
    public static double horizontalScale(double bodyCm, double deltaCm) {
        if (!(bodyCm > 0) || !Double.isFinite(bodyCm) || !Double.isFinite(deltaCm)) {
            return 1.0;
        }
        double sx = 1.0 + SCALE_ALPHA * (deltaCm / bodyCm);
        return clamp(sx, SCALE_MIN, SCALE_MAX);
    }

    /** Mild vertical scale following {@code scaleX} toward 1. */
    public static double verticalScale(double scaleX) {
        if (!Double.isFinite(scaleX)) {
            return 1.0;
        }
        return 1.0 + VERTICAL_FOLLOW * (scaleX - 1.0);
    }

    public static FitResult analyze(String slot, Map<String, String> body, Map<String, String> garment) {
        String normalizedSlot = slot != null ? slot.trim().toUpperCase(Locale.ROOT) : "";
        Map<String, String> bodyMap = body != null ? body : Map.of();
        Map<String, String> garmentMap = garment != null ? garment : Map.of();

        if ("SHOES".equals(normalizedSlot)
                || "HAT".equals(normalizedSlot)
                || "BAG".equals(normalizedSlot)
                || "JEWELRY".equals(normalizedSlot)) {
            return new FitResult(
                    Fit.REGULAR,
                    null,
                    true,
                    false,
                    null,
                    null,
                    null,
                    true,
                    1.0,
                    1.0
            );
        }

        // Length keys (sleeve / pant hem) are style-relative — excluded from overall try-on fit.
        Primary primary = switch (normalizedSlot) {
            case "TOP", "OUTER" -> primaryOrAverage(
                    pair(garmentMap, bodyMap, "chest", "chest", "chest"),
                    List.of(
                            pair(garmentMap, bodyMap, "chest", "chest", "chest"),
                            pair(garmentMap, bodyMap, "shoulder", "shoulder", "shoulder")
                    )
            );
            case "BOTTOM" -> primaryOrAverage(
                    pair(garmentMap, bodyMap, "waist", "waist", "waist"),
                    List.of(
                            pair(garmentMap, bodyMap, "waist", "waist", "waist"),
                            pair(garmentMap, bodyMap, "hip", "hip", "hip"),
                            pair(garmentMap, bodyMap, "thigh", "thighCircumference", "thigh")
                    )
            );
            case "DRESS" -> averageOf(
                    List.of(
                            pair(garmentMap, bodyMap, "shoulder", "shoulder", "shoulder"),
                            pair(garmentMap, bodyMap, "chest", "chest", "chest"),
                            pair(garmentMap, bodyMap, "waist", "waist", "waist")
                    )
            );
            default -> null;
        };

        if (primary == null) {
            String appearancePrompt = buildTryOnPrompt(
                    null, null, null, normalizedSlot, true, garmentMap);
            return new FitResult(
                    Fit.REGULAR,
                    appearancePrompt,
                    true,
                    false,
                    null,
                    null,
                    null,
                    true,
                    1.0,
                    1.0
            );
        }

        Fit fit = band(primary.deltaCm());
        double scaleX = horizontalScale(primary.bodyCm(), primary.deltaCm());
        double scaleY = verticalScale(scaleX);
        boolean skipWarp = shouldSkipWarp(fit, primary.deltaCm(), scaleX, scaleY);
        boolean skipStage2 = shouldSkipStage2(fit, primary.deltaCm());
        String prompt = buildTryOnPrompt(
                fit,
                primary.deltaCm(),
                primary.bodyCm(),
                normalizedSlot,
                false,
                garmentMap
        );
        return new FitResult(
                fit,
                prompt,
                skipStage2,
                muchTooSmall(primary.deltaCm()),
                primary.key(),
                primary.deltaCm(),
                primary.bodyCm(),
                skipWarp,
                skipWarp ? 1.0 : scaleX,
                skipWarp ? 1.0 : scaleY
        );
    }

    /**
     * Per-part garment-vs-body comparisons for the fit-map.
     * Girth/shoulder use raw garment−body Δ. Sleeve ({@code armLength}) and BOTTOM hem
     * ({@code totalLength} vs {@code legLength}) use category-relative length ratios so
     * short sleeves / shorts are not always "very tight".
     * SHOES and unknown slots return an empty list.
     */
    public static List<PartComparison> partComparisons(
            String slot,
            Map<String, String> body,
            Map<String, String> garment
    ) {
        return partComparisons(slot, null, body, garment);
    }

    public static List<PartComparison> partComparisons(
            String slot,
            String categoryCode,
            Map<String, String> body,
            Map<String, String> garment
    ) {
        String normalizedSlot = slot != null ? slot.trim().toUpperCase(Locale.ROOT) : "";
        Map<String, String> bodyMap = body != null ? body : Map.of();
        Map<String, String> garmentMap = garment != null ? garment : Map.of();

        // {garmentKey, bodyKey, reportKey, mode: raw | sleeve | leg}
        List<String[]> specs = switch (normalizedSlot) {
            case "TOP", "OUTER" -> List.of(
                    new String[] {"shoulder", "shoulder", "shoulder", "raw"},
                    new String[] {"chest", "chest", "chest", "raw"},
                    new String[] {"armLength", "armLength", "armLength", "sleeve"},
                    new String[] {"totalLength", "torsoLength", "totalLength", "raw"}
            );
            case "BOTTOM" -> List.of(
                    new String[] {"waist", "waist", "waist", "raw"},
                    new String[] {"hip", "hip", "hip", "raw"},
                    new String[] {"thigh", "thighCircumference", "thigh", "raw"},
                    new String[] {"totalLength", "legLength", "totalLength", "leg"}
            );
            case "DRESS" -> List.of(
                    new String[] {"shoulder", "shoulder", "shoulder", "raw"},
                    new String[] {"chest", "chest", "chest", "raw"},
                    new String[] {"armLength", "armLength", "armLength", "sleeve"},
                    new String[] {"waist", "waist", "waist", "raw"},
                    new String[] {"hip", "hip", "hip", "raw"}
            );
            default -> List.of();
        };

        List<PartComparison> out = new ArrayList<>(specs.size());
        for (String[] spec : specs) {
            Double garmentCm = parseCm(garmentMap.get(spec[0]));
            Double bodyCm = parseCm(bodyMap.get(spec[1]));
            if (garmentCm == null || bodyCm == null || !(bodyCm > 0)) {
                out.add(new PartComparison(spec[2], bodyCm, garmentCm, null, PartBand.UNKNOWN));
                continue;
            }
            String mode = spec[3];
            if ("sleeve".equals(mode)) {
                out.add(lengthStyleComparison(
                        spec[2], bodyCm, garmentCm, sleeveStyle(normalizedSlot, categoryCode)));
            } else if ("leg".equals(mode)) {
                out.add(lengthStyleComparison(
                        spec[2], bodyCm, garmentCm, legStyle(categoryCode)));
            } else {
                double deltaCm = garmentCm - bodyCm;
                out.add(new PartComparison(spec[2], bodyCm, garmentCm, deltaCm, partBand(deltaCm)));
            }
        }
        return out;
    }

    enum LengthStyle {
        SLEEVELESS(0.0, 0.15, true),
        SHORT(0.30, 0.55, false),
        LONG(0.85, 1.05, false),
        LEG_SHORT(0.35, 0.55, false),
        LEG_LONG(0.90, 1.05, false),
        SKIRT(0.35, 0.95, false);

        final double minRatio;
        final double maxRatio;
        /** When true, OK means ratio ≤ maxRatio (no lower bound). */
        final boolean upperBoundOnly;

        LengthStyle(double minRatio, double maxRatio, boolean upperBoundOnly) {
            this.minRatio = minRatio;
            this.maxRatio = maxRatio;
            this.upperBoundOnly = upperBoundOnly;
        }
    }

    static LengthStyle sleeveStyle(String slot, String categoryCode) {
        if ("OUTER".equals(slot)) {
            return LengthStyle.LONG;
        }
        String cat = categoryCode != null ? categoryCode.trim() : "";
        if ("민소매".equals(cat)) {
            return LengthStyle.SLEEVELESS;
        }
        if ("반팔".equals(cat)) {
            return LengthStyle.SHORT;
        }
        // TOP 긴팔/셔츠/후드/…, DRESS 긴팔, legacy 원피스, missing → long
        return LengthStyle.LONG;
    }

    static LengthStyle legStyle(String categoryCode) {
        String cat = categoryCode != null ? categoryCode.trim() : "";
        if ("반바지".equals(cat)) {
            return LengthStyle.LEG_SHORT;
        }
        if ("치마".equals(cat)) {
            return LengthStyle.SKIRT;
        }
        // 데님 / 면바지 / 슬랙스 / unknown → long
        return LengthStyle.LEG_LONG;
    }

    /**
     * Ratio-based length fit: in-range → Δ=0 (딱 맞음); outside → Δ = distance from band edge × bodyCm
     * so FE status thresholds stay meaningful.
     */
    static PartComparison lengthStyleComparison(
            String key,
            double bodyCm,
            double garmentCm,
            LengthStyle style
    ) {
        double ratio = garmentCm / bodyCm;
        double deltaCm;
        if (style.upperBoundOnly) {
            if (ratio <= style.maxRatio) {
                deltaCm = 0.0;
            } else {
                deltaCm = (ratio - style.maxRatio) * bodyCm;
            }
        } else if (ratio < style.minRatio) {
            deltaCm = (ratio - style.minRatio) * bodyCm;
        } else if (ratio > style.maxRatio) {
            deltaCm = (ratio - style.maxRatio) * bodyCm;
        } else {
            deltaCm = 0.0;
        }
        return new PartComparison(key, bodyCm, garmentCm, deltaCm, partBand(deltaCm));
    }

    /** Same thresholds as {@link #band(double)}: Δ≤−2 SMALL, −2&lt;Δ≤+4 OK, Δ&gt;+4 LARGE. */
    static PartBand partBand(double garmentMinusBodyCm) {
        return switch (band(garmentMinusBodyCm)) {
            case SLIM -> PartBand.SMALL;
            case REGULAR -> PartBand.OK;
            case LOOSE -> PartBand.LARGE;
        };
    }

    static boolean shouldSkipWarp(Fit fit, double deltaCm, double scaleX, double scaleY) {
        // Inward warp (scaleX < 1) shrinks the torso/body instead of making the garment look
        // tight; slim/undersized fits are rendered via the Stage2 tension prompt only.
        if (scaleX < 1.0) {
            return true;
        }
        if (fit == Fit.REGULAR && Math.abs(deltaCm) < SKIP_WARP_ABS_DELTA_CM) {
            return true;
        }
        return Math.abs(scaleX - 1.0) < 1e-4 && Math.abs(scaleY - 1.0) < 1e-4;
    }

    /** Stage2 skipped for tiny REGULAR deltas (same simplicity as shoes / missing primary). */
    static boolean shouldSkipStage2(Fit fit, double deltaCm) {
        return fit == Fit.REGULAR && Math.abs(deltaCm) < SKIP_WARP_ABS_DELTA_CM;
    }

    static Fit band(double garmentMinusBodyCm) {
        if (garmentMinusBodyCm <= -2.0) {
            return Fit.SLIM;
        }
        if (garmentMinusBodyCm <= 4.0) {
            return Fit.REGULAR;
        }
        return Fit.LOOSE;
    }

    /** |Δ| above this fraction of body circumference → likely erroneous; omit raw Δ from prompt. */
    static final double PROMPT_DELTA_CAP_RATIO = 0.20;

    /**
     * Single-call Gemini try-on prompt: dress person (Image 1) with garment (Image 2).
     *
     * @param appearanceOnly when true (skipFit / missing primary), omit fit-band instructions
     */
    public static String buildTryOnPrompt(
            Fit fit,
            Double deltaCm,
            Double bodyCm,
            String slot,
            boolean appearanceOnly
    ) {
        return buildTryOnPrompt(fit, deltaCm, bodyCm, slot, appearanceOnly, null, null);
    }

    public static String buildTryOnPrompt(
            Fit fit,
            Double deltaCm,
            Double bodyCm,
            String slot,
            boolean appearanceOnly,
            Map<String, String> garmentMeasurements
    ) {
        return buildTryOnPrompt(
                fit, deltaCm, bodyCm, slot, appearanceOnly, garmentMeasurements, null);
    }

    public static String buildTryOnPrompt(
            Fit fit,
            Double deltaCm,
            Double bodyCm,
            String slot,
            boolean appearanceOnly,
            Map<String, String> garmentMeasurements,
            String sex
    ) {
        StringBuilder sb = new StringBuilder();
        sb.append(CLAUSE_TASK).append('\n').append('\n');
        sb.append(CLAUSE_PROCESSING_BASE).append('\n').append('\n');
        sb.append(CLAUSE_OUTPUT_FRAME).append('\n').append('\n');
        sb.append(CLAUSE_PERSON).append('\n').append('\n');
        sb.append(sexClause(sex)).append('\n').append('\n');
        sb.append(CLAUSE_GARMENT_COVERAGE).append('\n').append('\n');
        sb.append(CLAUSE_LOGO_TEXT).append('\n');        if (slot != null && !slot.isBlank()) {
            sb.append("\nGarment slot: ").append(slot.trim().toUpperCase(Locale.ROOT)).append('.');
            if ("HAT".equalsIgnoreCase(slot.trim())) {
                sb.append(
                        " Place the hat on the head naturally matching the product "
                                + "(cap/beanie/bucket); do not omit it."
                );
            }
            if ("SHOES".equalsIgnoreCase(slot.trim())) {
                sb.append(
                        " Place the shoes on both feet matching the product; do not omit footwear."
                );
            }
        }
        appendGarmentSizeFacts(
                sb,
                List.of(slot != null ? slot : "GARMENT"),
                List.of(garmentMeasurements != null ? garmentMeasurements : Map.of())
        );
        if (!appearanceOnly && fit != null) {
            sb.append('\n').append('\n');
            sb.append(fitClause(fit));
            String measurement = measurementClause(fit, deltaCm, bodyCm);
            if (measurement != null) {
                sb.append('\n').append(measurement);
            }
            if (deltaCm != null
                    && bodyCm != null
                    && bodyCm > 0
                    && Math.abs(deltaCm) <= PROMPT_DELTA_CAP_RATIO * bodyCm
                    && muchTooSmall(deltaCm)) {
                sb.append(
                        "\nShow pronounced stretch wrinkles; the fabric is visibly strained."
                );
            }
        } else {
            sb.append("\n\nFIT: appearance only — natural drape; match Image 2 coverage exactly.");
        }
        return sb.toString().trim();
    }

    /**
     * Multi-garment lookbook prompt. {@code slotLabels} align with Image 2..N order.
     * When {@code appearanceOnly}, omit fit-band instructions.
     */
    public static String buildMultiTryOnPrompt(
            List<String> slotLabels,
            Fit overallFit,
            boolean appearanceOnly
    ) {
        return buildMultiTryOnPrompt(slotLabels, null, overallFit, appearanceOnly, null);
    }

    /**
     * @param fitsPerGarment optional per-image fits (same order as {@code slotLabels}); when null,
     *                       uses {@code overallFit} once for the whole outfit
     */
    public static String buildMultiTryOnPrompt(
            List<String> slotLabels,
            List<Fit> fitsPerGarment,
            Fit overallFit,
            boolean appearanceOnly
    ) {
        return buildMultiTryOnPrompt(
                slotLabels, fitsPerGarment, overallFit, appearanceOnly, null, null);
    }

    /**
     * @param garmentMeasurementsPerImage optional product size maps aligned with Image 2..N
     */
    public static String buildMultiTryOnPrompt(
            List<String> slotLabels,
            List<Fit> fitsPerGarment,
            Fit overallFit,
            boolean appearanceOnly,
            List<Map<String, String>> garmentMeasurementsPerImage
    ) {
        return buildMultiTryOnPrompt(
                slotLabels,
                fitsPerGarment,
                overallFit,
                appearanceOnly,
                garmentMeasurementsPerImage,
                null
        );
    }

    public static String buildMultiTryOnPrompt(
            List<String> slotLabels,
            List<Fit> fitsPerGarment,
            Fit overallFit,
            boolean appearanceOnly,
            List<Map<String, String>> garmentMeasurementsPerImage,
            String sex
    ) {
        StringBuilder sb = new StringBuilder();
        sb.append(CLAUSE_TASK_MULTI).append('\n').append('\n');
        sb.append(CLAUSE_PROCESSING_BASE).append('\n').append('\n');
        sb.append(CLAUSE_OUTPUT_FRAME).append('\n').append('\n');
        sb.append(CLAUSE_PERSON).append('\n').append('\n');
        sb.append(sexClause(sex)).append('\n').append('\n');
        sb.append(CLAUSE_GARMENT_COVERAGE).append('\n').append('\n');
        sb.append(CLAUSE_LOGO_TEXT).append('\n');        if (slotLabels != null && !slotLabels.isEmpty()) {
            sb.append("\nGarment images (in order):\n");
            for (int i = 0; i < slotLabels.size(); i++) {
                String slot = slotLabels.get(i);
                String label = slot != null && !slot.isBlank()
                        ? slot.trim().toUpperCase(Locale.ROOT)
                        : "GARMENT";
                sb.append("- Image ").append(i + 2).append(": ").append(label);
                if (!appearanceOnly
                        && fitsPerGarment != null
                        && i < fitsPerGarment.size()
                        && fitsPerGarment.get(i) != null) {
                    sb.append(" (").append(fitsPerGarment.get(i).wireValue()).append(" fit)");
                }
                sb.append('\n');
            }
            sb.append("Wear every listed garment together; do not drop any.\n");
            boolean hasHat = slotLabels.stream()
                    .anyMatch(s -> s != null && "HAT".equalsIgnoreCase(s.trim()));
            if (hasHat) {
                sb.append(
                        "HAT must be worn on the head in a natural position matching the product "
                                + "(cap/beanie/bucket as shown); do not leave it off or hold it.\n"
                );
            }
            boolean hasShoes = slotLabels.stream()
                    .anyMatch(s -> s != null && "SHOES".equalsIgnoreCase(s.trim()));
            if (hasShoes) {
                sb.append(
                        "SHOES must be worn on both feet matching the product design; "
                                + "do not leave the person barefoot or invent different footwear.\n"
                );
            }
        }
        appendGarmentSizeFacts(sb, slotLabels, garmentMeasurementsPerImage);
        if (!appearanceOnly) {
            if (fitsPerGarment != null && !fitsPerGarment.isEmpty()) {
                // Labels already on each garment line; emit fit definitions once.
                sb.append('\n').append(FIT_LEGEND);
            } else if (overallFit != null) {
                sb.append('\n').append(fitClause(overallFit));
                sb.append(" Apply this overall fit to the full outfit consistently.");
            } else {
                sb.append("\nFIT: appearance only — natural drape; match each product coverage exactly.");
            }
        } else {
            sb.append("\nFIT: appearance only — natural drape; match each product coverage exactly.");
        }
        return sb.toString().trim();
    }

    /**
     * Follow-up pass prompt: keep Image 1 outfit; only apply Images 2..N (e.g. HAT/SHOES).
     */
    public static String buildFollowUpTryOnPrompt(
            List<String> slotLabels,
            List<Fit> fitsPerGarment,
            Fit overallFit,
            boolean appearanceOnly,
            List<Map<String, String>> garmentMeasurementsPerImage
    ) {
        return buildFollowUpTryOnPrompt(
                slotLabels,
                fitsPerGarment,
                overallFit,
                appearanceOnly,
                garmentMeasurementsPerImage,
                null
        );
    }

    public static String buildFollowUpTryOnPrompt(
            List<String> slotLabels,
            List<Fit> fitsPerGarment,
            Fit overallFit,
            boolean appearanceOnly,
            List<Map<String, String>> garmentMeasurementsPerImage,
            String sex
    ) {
        StringBuilder sb = new StringBuilder();
        sb.append(CLAUSE_TASK_FOLLOW_UP).append('\n').append('\n');
        sb.append(CLAUSE_PROCESSING_BASE).append('\n').append('\n');
        sb.append(CLAUSE_OUTPUT_FRAME).append('\n').append('\n');
        sb.append(CLAUSE_PERSON).append('\n').append('\n');
        sb.append(sexClause(sex)).append('\n').append('\n');
        sb.append(CLAUSE_GARMENT_COVERAGE).append('\n').append('\n');
        sb.append(CLAUSE_LOGO_TEXT).append('\n');        if (slotLabels != null && !slotLabels.isEmpty()) {
            sb.append("\nNew garment images only (in order):\n");
            for (int i = 0; i < slotLabels.size(); i++) {
                String slot = slotLabels.get(i);
                String label = slot != null && !slot.isBlank()
                        ? slot.trim().toUpperCase(Locale.ROOT)
                        : "GARMENT";
                sb.append("- Image ").append(i + 2).append(": ").append(label);
                if (!appearanceOnly
                        && fitsPerGarment != null
                        && i < fitsPerGarment.size()
                        && fitsPerGarment.get(i) != null) {
                    sb.append(" (").append(fitsPerGarment.get(i).wireValue()).append(" fit)");
                }
                sb.append('\n');
            }
            sb.append("Apply every listed new garment; do not invent extras.\n");
            boolean hasHat = slotLabels.stream()
                    .anyMatch(s -> s != null && "HAT".equalsIgnoreCase(s.trim()));
            if (hasHat) {
                sb.append(
                        "HAT must be worn on the head matching the product; keep hair natural under/around it.\n"
                );
            }
            boolean hasShoes = slotLabels.stream()
                    .anyMatch(s -> s != null && "SHOES".equalsIgnoreCase(s.trim()));
            if (hasShoes) {
                sb.append(
                        "SHOES must be worn on both feet matching the product; do not change pants/hem above.\n"
                );
            }
        }
        appendGarmentSizeFacts(sb, slotLabels, garmentMeasurementsPerImage);
        if (!appearanceOnly) {
            if (fitsPerGarment != null && !fitsPerGarment.isEmpty()) {
                sb.append('\n').append(FIT_LEGEND);
            } else if (overallFit != null) {
                sb.append('\n').append(fitClause(overallFit));
                sb.append(" Apply this fit only to the new garments.");
            } else {
                sb.append("\nFIT: appearance only — natural drape on new items; keep Image 1 outfit.");
            }
        } else {
            sb.append("\nFIT: appearance only — natural drape on new items; keep Image 1 outfit.");
        }
        return sb.toString().trim();
    }

    /**
     * Appends product size facts when at least one garment has parseable measurements.
     * Useful when body size is missing (no Δ) but item labels still guide drape/scale.
     */
    static void appendGarmentSizeFacts(
            StringBuilder sb,
            List<String> slotLabels,
            List<Map<String, String>> garmentMeasurementsPerImage
    ) {
        if (sb == null || garmentMeasurementsPerImage == null || garmentMeasurementsPerImage.isEmpty()) {
            return;
        }
        int n = slotLabels != null ? slotLabels.size() : garmentMeasurementsPerImage.size();
        StringBuilder block = new StringBuilder();
        for (int i = 0; i < n; i++) {
            Map<String, String> map = i < garmentMeasurementsPerImage.size()
                    ? garmentMeasurementsPerImage.get(i)
                    : null;
            String facts = formatGarmentSizeLine(map);
            if (facts == null) {
                continue;
            }
            String slot = slotLabels != null && i < slotLabels.size() ? slotLabels.get(i) : null;
            String label = slot != null && !slot.isBlank()
                    ? slot.trim().toUpperCase(Locale.ROOT)
                    : "GARMENT";
            block.append("- Image ").append(i + 2).append(" (").append(label).append("): ");
            block.append(facts).append('\n');
        }
        if (block.isEmpty()) {
            return;
        }
        sb.append("\n\nGarment sizes (product label measurements):\n").append(block);
        sb.append(
                "Honor these absolute sizes when draping. If no body measurements are available, "
                        + "still scale each garment to match these product numbers on the person in Image 1."
        );
    }

    /** Ordered keys aligned with FE item measurement fields. */
    private static final List<String> GARMENT_SIZE_KEYS = List.of(
            "shoulder",
            "chest",
            "armLength",
            "totalLength",
            "waist",
            "rise",
            "thigh",
            "hem",
            "hip",
            "shoeSize"
    );

    /**
     * @return comma-separated {@code key unit} facts, or null if none parseable
     */
    static String formatGarmentSizeLine(Map<String, String> measurements) {
        if (measurements == null || measurements.isEmpty()) {
            return null;
        }
        List<String> parts = new ArrayList<>();
        for (String key : GARMENT_SIZE_KEYS) {
            String raw = measurements.get(key);
            if (raw == null || raw.isBlank()) {
                continue;
            }
            Double value = parseCm(raw);
            if (value == null) {
                continue;
            }
            if ("shoeSize".equals(key)) {
                parts.add(String.format(Locale.US, "shoeSize %.0f mm", value));
            } else {
                parts.add(String.format(Locale.US, "%s %.1f cm", key, value));
            }
        }
        if (parts.isEmpty()) {
            return null;
        }
        return String.join(", ", parts);
    }

    /** Aggregate fit badge for multi-garment: SLIM wins, then LOOSE, else REGULAR. */
    public static Fit aggregateFit(List<Fit> fits) {
        if (fits == null || fits.isEmpty()) {
            return Fit.REGULAR;
        }
        boolean anySlim = false;
        boolean anyLoose = false;
        for (Fit f : fits) {
            if (f == Fit.SLIM) {
                anySlim = true;
            } else if (f == Fit.LOOSE) {
                anyLoose = true;
            }
        }
        if (anySlim) {
            return Fit.SLIM;
        }
        if (anyLoose) {
            return Fit.LOOSE;
        }
        return Fit.REGULAR;
    }

    /** @deprecated Use {@link #buildTryOnPrompt}; kept for older tests calling buildPrompt. */
    @Deprecated
    static String buildPrompt(Fit fit, Double deltaCm, Double bodyCm, String slot) {
        if (fit == null
                || deltaCm == null
                || bodyCm == null
                || !(bodyCm > 0)
                || !Double.isFinite(deltaCm)
                || !Double.isFinite(bodyCm)) {
            return null;
        }
        return buildTryOnPrompt(fit, deltaCm, bodyCm, slot, false);
    }

    private static String fitClause(Fit fit) {
        return switch (fit) {
            case SLIM -> FIT_SLIM;
            case LOOSE -> FIT_LOOSE;
            case REGULAR -> FIT_REGULAR;
        };
    }

    private static String measurementClause(Fit fit, Double deltaCm, Double bodyCm) {
        if (deltaCm == null || bodyCm == null || !(bodyCm > 0)
                || !Double.isFinite(deltaCm) || !Double.isFinite(bodyCm)) {
            return "Fit band: " + fit.wireValue() + ".";
        }
        boolean capped = Math.abs(deltaCm) > PROMPT_DELTA_CAP_RATIO * bodyCm;
        if (capped) {
            String extreme = deltaCm < 0
                    ? "The garment is much too small for this body (extreme size difference)."
                    : "The garment is much too large for this body (extreme size difference).";
            return "Fit band: " + fit.wireValue() + ". " + extreme;
        }
        return String.format(
                Locale.US,
                "Fit band: %s. Primary garment−body Δ=%+.1f cm; body circumference ≈ %.1f cm.",
                fit.wireValue(),
                deltaCm,
                bodyCm
        );
    }

    private record Primary(String key, double deltaCm, double bodyCm) {
    }

    private record Pair(String key, Double deltaCm, Double bodyCm) {
    }

    /** Prefer explicit primary when present; otherwise average of available pairs. */
    private static Primary primaryOrAverage(Pair primary, List<Pair> candidates) {
        if (primary != null && primary.deltaCm() != null && primary.bodyCm() != null) {
            return new Primary(primary.key(), primary.deltaCm(), primary.bodyCm());
        }
        return averageOf(candidates);
    }

    private static Primary averageOf(List<Pair> candidates) {
        List<Pair> present = new ArrayList<>();
        for (Pair p : candidates) {
            if (p != null && p.deltaCm() != null && p.bodyCm() != null && p.bodyCm() > 0) {
                present.add(p);
            }
        }
        if (present.isEmpty()) {
            return null;
        }
        double deltaSum = 0;
        double bodySum = 0;
        for (Pair p : present) {
            deltaSum += p.deltaCm();
            bodySum += p.bodyCm();
        }
        // Label with the tightest (most negative Δ) key among averaged pairs.
        String key = present.stream()
                .min(Comparator.comparingDouble(Pair::deltaCm))
                .map(Pair::key)
                .orElse(present.get(0).key());
        return new Primary(key, deltaSum / present.size(), bodySum / present.size());
    }

    private static Pair pair(
            Map<String, String> garment,
            Map<String, String> body,
            String garmentKey,
            String bodyKey,
            String reportKey
    ) {
        Double g = parseCm(garment.get(garmentKey));
        Double b = parseCm(body.get(bodyKey));
        if (g == null || b == null) {
            return new Pair(reportKey, null, null);
        }
        return new Pair(reportKey, g - b, b);
    }

    /** garment − body when both parse as finite numbers; else null. */
    static Double delta(
            Map<String, String> garment,
            Map<String, String> body,
            String garmentKey,
            String bodyKey
    ) {
        Pair p = pair(garment, body, garmentKey, bodyKey, garmentKey);
        return p.deltaCm();
    }

    static Double parseCm(String raw) {
        if (raw == null) {
            return null;
        }
        String trimmed = raw.trim().replace(',', '.');
        if (trimmed.isEmpty()) {
            return null;
        }
        try {
            double value = Double.parseDouble(trimmed);
            return Double.isFinite(value) ? value : null;
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    private static double clamp(double value, double min, double max) {
        return Math.max(min, Math.min(max, value));
    }
}
