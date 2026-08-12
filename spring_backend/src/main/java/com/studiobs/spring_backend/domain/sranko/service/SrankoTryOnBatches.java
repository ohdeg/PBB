package com.studiobs.spring_backend.domain.sranko.service;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/** Split try-on garments into body / accessory / rest batches for multi-pass Gemini. */
public final class SrankoTryOnBatches {

    public static final int MULTI_PASS_MIN = 4;

    private static final Set<String> BODY_SLOTS = Set.of("OUTER", "TOP", "BOTTOM", "DRESS");
    private static final Set<String> ACCESSORY_SLOTS = Set.of("HAT", "SHOES");

    private SrankoTryOnBatches() {
    }

    public record Batches<T>(List<T> body, List<T> accessories, List<T> rest) {
        public boolean accessoriesEmpty() {
            return accessories == null || accessories.isEmpty();
        }

        public boolean restEmpty() {
            return rest == null || rest.isEmpty();
        }

        public boolean bodyEmpty() {
            return body == null || body.isEmpty();
        }
    }

    public static boolean shouldMultiPass(int garmentCount) {
        return garmentCount >= MULTI_PASS_MIN;
    }

    public static <T> Batches<T> partition(List<T> garments, SlotFn<T> slotFn) {
        List<T> body = new ArrayList<>();
        List<T> accessories = new ArrayList<>();
        List<T> rest = new ArrayList<>();
        if (garments == null) {
            return new Batches<>(body, accessories, rest);
        }
        for (T g : garments) {
            String slot = normalizeSlot(slotFn.slot(g));
            if (BODY_SLOTS.contains(slot)) {
                body.add(g);
            } else if (ACCESSORY_SLOTS.contains(slot)) {
                accessories.add(g);
            } else {
                rest.add(g);
            }
        }
        return new Batches<>(List.copyOf(body), List.copyOf(accessories), List.copyOf(rest));
    }

    static String normalizeSlot(String slot) {
        return slot != null ? slot.trim().toUpperCase(Locale.ROOT) : "";
    }

    @FunctionalInterface
    public interface SlotFn<T> {
        String slot(T value);
    }
}
