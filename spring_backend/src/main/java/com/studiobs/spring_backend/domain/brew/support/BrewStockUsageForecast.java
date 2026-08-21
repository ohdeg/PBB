package com.studiobs.spring_backend.domain.brew.support;

import com.studiobs.spring_backend.domain.brew.entity.BrewStoreStock;
import com.studiobs.spring_backend.domain.brew.entity.BrewStoreStockUsageDay;
import java.time.LocalDate;
import java.util.Collection;

public final class BrewStockUsageForecast {

    public static final int WINDOW_DAYS = 14;
    public static final int MIN_SAMPLE_DAYS = 3;
    public static final int SOON_WITHIN_DAYS = 3;

    private BrewStockUsageForecast() {
    }

    public record Forecast(boolean soonLow, Integer daysOfStock) {
        public static final Forecast NONE = new Forecast(false, null);
    }

    public static LocalDate windowStart(LocalDate today) {
        return today.minusDays(WINDOW_DAYS - 1L);
    }

    public static Forecast compute(BrewStoreStock stock, Collection<BrewStoreStockUsageDay> days) {
        return compute(stock.getStockNum(), stock.getStockMinNum(), days);
    }

    public static Forecast compute(
            int stockNum,
            Integer stockMinNum,
            Collection<BrewStoreStockUsageDay> days
    ) {
        int dayCount = 0;
        long sum = 0;
        for (BrewStoreStockUsageDay day : days) {
            if (day.getQty() > 0) {
                dayCount++;
                sum += day.getQty();
            }
        }
        if (dayCount < MIN_SAMPLE_DAYS || sum <= 0) {
            return Forecast.NONE;
        }
        double avg = (double) sum / dayCount;
        int daysOfStock = (int) Math.floor(stockNum / avg);
        boolean alreadyLow = stockMinNum != null && stockNum <= stockMinNum;
        int min = stockMinNum == null ? 0 : stockMinNum;
        int remaining = Math.max(0, stockNum - min);
        boolean soonLow = !alreadyLow && remaining / avg <= SOON_WITHIN_DAYS;
        return new Forecast(soonLow, daysOfStock);
    }
}
