package com.studiobs.spring_backend.domain.lotto.service;

import com.studiobs.spring_backend.domain.lotto.dto.ContinuousPreferenceDto;
import com.studiobs.spring_backend.domain.lotto.dto.DiscretePreferenceDto;
import com.studiobs.spring_backend.domain.lotto.dto.LottoPatternProfileResponse;
import com.studiobs.spring_backend.domain.lotto.dto.LottoPatternProfilesResponse;
import com.studiobs.spring_backend.domain.lotto.entity.LottoDraw;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import org.springframework.stereotype.Service;

/**
 * 당첨 회차에서 구간별 패턴 profile을 학습한다 (FE {@code lottoPatternLearn.ts}와 동일 계약).
 */
@Service
public class LottoPatternLearnService {

    public static final List<String> WINDOWS = List.of("all", "52", "12", "8", "4");

    private static final Map<String, Double> STRENGTH_BY_WINDOW = Map.of(
            "all", 0.7,
            "52", 0.6,
            "12", 0.5,
            "8", 0.4,
            "4", 0.3
    );
    private static final double MAX_STRENGTH = 0.7;

    private static final Set<Integer> PRIMES = Set.of(
            2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43
    );
    private static final int[][] DECADE_RANGES = {
            {1, 9}, {10, 19}, {20, 29}, {30, 39}, {40, 45}
    };

    public LottoPatternProfilesResponse buildAll(List<LottoDraw> drawsAsc) {
        Map<String, LottoPatternProfileResponse> profiles = new LinkedHashMap<>();
        for (String window : WINDOWS) {
            LottoPatternProfileResponse profile = buildOne(drawsAsc, window);
            if (profile != null) {
                profiles.put(window, profile);
            }
        }
        return new LottoPatternProfilesResponse(profiles);
    }

    public LottoPatternProfileResponse buildOne(List<LottoDraw> drawsAsc, String window) {
        List<LottoDraw> windowDraws = sliceWindow(drawsAsc, window);
        if (windowDraws.isEmpty()) {
            return null;
        }

        List<FeatureRow> rows = new ArrayList<>();
        for (int i = 0; i < windowDraws.size(); i++) {
            List<Integer> current = parseMainNumbers(windowDraws.get(i).getMainNumbers());
            List<Integer> previous = i > 0
                    ? parseMainNumbers(windowDraws.get(i - 1).getMainNumbers())
                    : List.of();
            FeatureRow row = extract(current, previous);
            if (row != null) {
                rows.add(row);
            }
        }
        if (rows.isEmpty()) {
            return null;
        }

        return new LottoPatternProfileResponse(
                window,
                rows.size(),
                learnStrength(rows.size(), window),
                buildDiscrete(rows, FeatureRow::oddCount),
                buildDiscrete(rows, FeatureRow::lowCount),
                buildDiscrete(rows, FeatureRow::primeCount),
                buildDiscrete(rows, FeatureRow::multipleOf3Count),
                buildDiscrete(rows, FeatureRow::decadeEmpty),
                buildDiscrete(rows, FeatureRow::carryOver),
                buildDiscrete(rows, FeatureRow::hasSameEnding),
                buildDiscrete(rows, FeatureRow::hasConsecutive),
                buildContinuous(rows, FeatureRow::sum),
                buildContinuous(rows, FeatureRow::span),
                buildContinuous(rows, FeatureRow::ac)
        );
    }

    static double learnStrength(int sampleSize, String window) {
        if (sampleSize <= 0) {
            return 0;
        }
        double strength = STRENGTH_BY_WINDOW.getOrDefault(window, 0.0);
        return Math.min(MAX_STRENGTH, Math.max(0, strength));
    }

    static List<LottoDraw> sliceWindow(List<LottoDraw> drawsAsc, String window) {
        if (drawsAsc.isEmpty()) {
            return List.of();
        }
        if ("all".equals(window)) {
            return drawsAsc;
        }
        int n;
        try {
            n = Integer.parseInt(window);
        } catch (NumberFormatException e) {
            return List.of();
        }
        if (n <= 0) {
            return List.of();
        }
        int from = Math.max(0, drawsAsc.size() - n);
        return drawsAsc.subList(from, drawsAsc.size());
    }

    private DiscretePreferenceDto buildDiscrete(
            List<FeatureRow> rows,
            java.util.function.ToIntFunction<FeatureRow> getter
    ) {
        Map<Integer, Integer> counts = new TreeMap<>();
        for (FeatureRow row : rows) {
            int v = getter.applyAsInt(row);
            counts.merge(v, 1, Integer::sum);
        }
        int mode = rows.get(0) == null ? 0 : getter.applyAsInt(rows.get(0));
        int best = -1;
        for (Map.Entry<Integer, Integer> e : counts.entrySet()) {
            int value = e.getKey();
            int count = e.getValue();
            if (count > best || (count == best && value < mode)) {
                best = count;
                mode = value;
            }
        }
        return new DiscretePreferenceDto(new HashMap<>(counts), mode, rows.size());
    }

    private ContinuousPreferenceDto buildContinuous(
            List<FeatureRow> rows,
            java.util.function.ToDoubleFunction<FeatureRow> getter
    ) {
        double[] values = rows.stream().mapToDouble(getter).sorted().toArray();
        return new ContinuousPreferenceDto(
                percentile(values, 0.1),
                percentile(values, 0.25),
                percentile(values, 0.5),
                percentile(values, 0.75),
                percentile(values, 0.9),
                values.length
        );
    }

    static double percentile(double[] sorted, double p) {
        if (sorted.length == 0) {
            return 0;
        }
        if (sorted.length == 1) {
            return sorted[0];
        }
        double idx = (sorted.length - 1) * p;
        int lo = (int) Math.floor(idx);
        int hi = (int) Math.ceil(idx);
        if (lo == hi) {
            return sorted[lo];
        }
        double w = idx - lo;
        return sorted[lo] * (1 - w) + sorted[hi] * w;
    }

    private FeatureRow extract(List<Integer> numbers, List<Integer> previous) {
        if (numbers.size() != 6) {
            return null;
        }
        List<Integer> sorted = numbers.stream().sorted().toList();

        Map<Integer, Integer> endings = new HashMap<>();
        for (int n : sorted) {
            endings.merge(n % 10, 1, Integer::sum);
        }
        int hasSameEnding = endings.values().stream().anyMatch(c -> c >= 2) ? 1 : 0;

        int hasConsecutive = 0;
        for (int i = 0; i < sorted.size() - 1; i++) {
            if (sorted.get(i + 1) - sorted.get(i) == 1) {
                hasConsecutive = 1;
                break;
            }
        }

        int filled = 0;
        for (int[] range : DECADE_RANGES) {
            int min = range[0];
            int max = range[1];
            boolean any = sorted.stream().anyMatch(n -> n >= min && n <= max);
            if (any) {
                filled++;
            }
        }
        int decadeEmpty = DECADE_RANGES.length - filled;

        int carryOver = 0;
        if (!previous.isEmpty()) {
            Set<Integer> prev = Set.copyOf(previous);
            for (int n : sorted) {
                if (prev.contains(n)) {
                    carryOver++;
                }
            }
        }

        int oddCount = (int) sorted.stream().filter(n -> n % 2 == 1).count();
        int lowCount = (int) sorted.stream().filter(n -> n <= 22).count();
        int primeCount = (int) sorted.stream().filter(PRIMES::contains).count();
        int multipleOf3Count = (int) sorted.stream().filter(n -> n % 3 == 0).count();
        int sum = sorted.stream().mapToInt(Integer::intValue).sum();
        int span = sorted.get(sorted.size() - 1) - sorted.get(0);
        int ac = calculateAc(sorted);

        return new FeatureRow(
                oddCount,
                lowCount,
                primeCount,
                multipleOf3Count,
                decadeEmpty,
                carryOver,
                hasSameEnding,
                hasConsecutive,
                sum,
                span,
                ac
        );
    }

    static int calculateAc(List<Integer> sorted) {
        java.util.HashSet<Integer> diffs = new java.util.HashSet<>();
        for (int i = 0; i < sorted.size(); i++) {
            for (int j = i + 1; j < sorted.size(); j++) {
                diffs.add(sorted.get(j) - sorted.get(i));
            }
        }
        return diffs.size() - (sorted.size() - 1);
    }

    static List<Integer> parseMainNumbers(String raw) {
        if (raw == null || raw.isBlank()) {
            return List.of();
        }
        return Arrays.stream(raw.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .map(Integer::valueOf)
                .sorted(Comparator.naturalOrder())
                .toList();
    }

    private record FeatureRow(
            int oddCount,
            int lowCount,
            int primeCount,
            int multipleOf3Count,
            int decadeEmpty,
            int carryOver,
            int hasSameEnding,
            int hasConsecutive,
            int sum,
            int span,
            int ac
    ) {
    }
}
