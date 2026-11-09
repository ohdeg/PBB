package com.studiobs.spring_backend.domain.dieta.service;

import com.studiobs.spring_backend.domain.dieta.dto.DietaActivityLogResponse;
import java.time.LocalDate;
import java.util.*;
import java.util.function.Function;

public final class DietaActivityHistory {
    public record Average(int value,int days) {}
    public record Suggestions(DietaActivityLogResponse previous, Map<String,Average> averages, String revision) {}

    public static Suggestions suggestions(List<DietaActivityLogResponse> rows, LocalDate day, String revision) {
        var fields=Map.<String,Function<DietaActivityLogResponse,Integer>>of(
                "steps", DietaActivityLogResponse::steps, "durationMin", DietaActivityLogResponse::durationMin,
                "exerciseKcal", DietaActivityLogResponse::exerciseKcal);
        var results=new TreeMap<String,Average>();
        fields.forEach((field,get)->{
            var numbers=rows.stream().filter(a->a.loggedOn().isBefore(day) && !a.loggedOn().isBefore(day.minusDays(28))
                    && !a.estimatedFields().contains(field)).map(get).filter(Objects::nonNull).mapToInt(Integer::intValue).summaryStatistics();
            if(numbers.getCount()>=3) results.put(field,new Average((int)Math.round(numbers.getAverage()),(int)numbers.getCount()));
        });
        return new Suggestions(rows.stream().filter(r->r.loggedOn().equals(day.minusDays(1))).findFirst().orElse(null),results,revision);
    }
}
