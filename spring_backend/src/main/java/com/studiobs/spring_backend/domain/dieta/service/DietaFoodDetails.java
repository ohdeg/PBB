package com.studiobs.spring_backend.domain.dieta.service;

import com.studiobs.spring_backend.domain.dieta.dto.gemini.DietaGeminiMealRequest.MealGroup;
import com.studiobs.spring_backend.domain.dieta.support.DietaIntakeSourceDocument.MacroTotals;
import java.math.BigDecimal;
import java.util.*;
import tools.jackson.databind.JsonNode;

public record DietaFoodDetails(Map<String,List<Food>> entries) {
    public record Food(String name, String portion, boolean estimatedPortion, MacroTotals nutrition) {}

    // Only accept complete, reconciled groups. A bad optional detail must not lose a paid analysis.
    static DietaFoodDetails validated(List<MealGroup> meals, JsonNode foods, Map<String,MacroTotals> totals) {
        var accepted = new LinkedHashMap<String,List<Food>>();
        if (foods == null || !foods.isArray()) return new DietaFoodDetails(accepted);
        var ids = new HashSet<String>();
        for (var meal : meals) {
            if (meal.entryIds() == null || !meal.entryIds().stream().allMatch(ids::add))
                return new DietaFoodDetails(Map.of());
        }
        var byId = new HashMap<String,JsonNode>();
        var duplicates = new HashSet<String>();
        for (var entry : foods) {
            var id = entry.path("entryId").asString("");
            if (!ids.contains(id)) return new DietaFoodDetails(Map.of());
            if (byId.put(id,entry.path("items")) != null) duplicates.add(id);
        }
        for (var meal : meals) {
            var subtotal = totals.get(meal.mealType());
            if (subtotal == null) continue;
            var group = new LinkedHashMap<String,List<Food>>();
            BigDecimal carbs = BigDecimal.ZERO, protein = BigDecimal.ZERO, fat = BigDecimal.ZERO;
            long kcal = 0;
            for (String id : meal.entryIds()) {
                var array = byId.get(id);
                if (duplicates.contains(id) || array == null || !array.isArray() || array.isEmpty()) break;
                var rows = new ArrayList<Food>();
                for (var node : array) {
                    var row = parse(node);
                    if (row == null) break;
                    rows.add(row);
                    var n = row.nutrition();
                    carbs = carbs.add(n.carbG());
                    protein = protein.add(n.proteinG());
                    fat = fat.add(n.fatG());
                    kcal += n.kcal();
                }
                if (rows.size() != array.size()) break;
                group.put(id,rows);
            }
            if (group.size() == meal.entryIds().size() && kcal == subtotal.kcal()
                    && close(carbs,subtotal.carbG()) && close(protein,subtotal.proteinG()) && close(fat,subtotal.fatG()))
                accepted.putAll(group);
        }
        return new DietaFoodDetails(accepted);
    }

    private static boolean close(BigDecimal a, BigDecimal b) {
        return a.subtract(b).abs().compareTo(new BigDecimal("0.1")) <= 0;
    }

    private static Food parse(JsonNode node) {
        for (String key : List.of("name","portion"))
            if (!node.path(key).isString() || node.path(key).asString().isBlank()) return null;
        if (!node.path("estimatedPortion").isBoolean()) return null;
        for (String key : List.of("carbG","proteinG","fatG","kcal")) {
            var value = node.path(key);
            if (!value.isNumber() || value.decimalValue().signum() < 0 ||
                    value.decimalValue().compareTo(BigDecimal.valueOf(999999)) > 0) return null;
        }
        var kcal = node.path("kcal").decimalValue();
        if (kcal.stripTrailingZeros().scale() > 0) return null;
        return new Food(node.path("name").asString(),node.path("portion").asString(),node.path("estimatedPortion").asBoolean(),
                new MacroTotals(node.path("carbG").decimalValue(),node.path("proteinG").decimalValue(),
                        node.path("fatG").decimalValue(),kcal.intValueExact()));
    }
}
