package com.studiobs.spring_backend.domain.dieta.service;

import com.studiobs.spring_backend.domain.dieta.dto.gemini.DietaGeminiMealRequest.MealGroup;
import com.studiobs.spring_backend.domain.dieta.support.DietaIntakeSourceDocument.MacroTotals;
import java.math.BigDecimal;
import java.util.*;
import tools.jackson.databind.JsonNode;

final class DietaMealBreakdown {
    static Map<String,MacroTotals> validated(List<MealGroup> meals, JsonNode node, MacroTotals total) {
        if (node == null || !node.isObject() || node.size() != meals.size()) return Map.of();
        var result = new LinkedHashMap<String,MacroTotals>();
        var sum = MacroTotals.zero();
        try {
            for (var meal : meals) {
                var part = node.path(meal.mealType());
                var values = new ArrayList<BigDecimal>();
                for (String key : List.of("carbG","proteinG","fatG","kcal")) {
                    var v = part.path(key);
                    if (!v.isNumber() || v.decimalValue().signum() < 0 || v.decimalValue().compareTo(BigDecimal.valueOf(999999)) > 0) return Map.of();
                    values.add(v.decimalValue());
                }
                var t = new MacroTotals(values.get(0),values.get(1),values.get(2),values.get(3).intValueExact());
                sum = sum.plus(t);
                result.put(meal.mealType(),t);
            }
        } catch (ArithmeticException invalid) { return Map.of(); }
        return sum.kcal() == total.kcal() && close(sum.carbG(),total.carbG()) && close(sum.proteinG(),total.proteinG())
                && close(sum.fatG(),total.fatG()) ? result : Map.of();
    }
    private static boolean close(BigDecimal a, BigDecimal b) {
        return a.subtract(b).abs().compareTo(new BigDecimal("0.1")) <= 0;
    }
}
