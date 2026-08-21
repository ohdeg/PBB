package com.studiobs.spring_backend.domain.brew.support;

import static org.assertj.core.api.Assertions.assertThat;

import com.studiobs.spring_backend.domain.brew.entity.BrewStoreStockUsageDay;
import com.studiobs.spring_backend.domain.brew.support.BrewStockUsageForecast.Forecast;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.Test;

class BrewStockUsageForecastTest {

    @Test
    void compute_returnsNone_whenFewerThanThreeDays() {
        Forecast forecast = BrewStockUsageForecast.compute(10, 2, List.of(
                day(1, 2),
                day(2, 2)));
        assertThat(forecast).isEqualTo(Forecast.NONE);
    }

    @Test
    void compute_ignoresZeroQtyDays() {
        Forecast forecast = BrewStockUsageForecast.compute(10, 1, List.of(
                day(1, 2),
                day(2, 2),
                day(3, 2),
                day(4, 0)));
        assertThat(forecast.daysOfStock()).isEqualTo(5);
        assertThat(forecast.soonLow()).isFalse();
    }

    @Test
    void compute_marksSoonLow_whenRemainingWithinThreeDays() {
        Forecast forecast = BrewStockUsageForecast.compute(8, 2, List.of(
                day(1, 2),
                day(2, 2),
                day(3, 2)));
        assertThat(forecast.daysOfStock()).isEqualTo(4);
        assertThat(forecast.soonLow()).isTrue();
    }

    @Test
    void compute_skipsSoonLow_whenAlreadyAtMin() {
        Forecast forecast = BrewStockUsageForecast.compute(2, 2, List.of(
                day(1, 2),
                day(2, 2),
                day(3, 2)));
        assertThat(forecast.soonLow()).isFalse();
        assertThat(forecast.daysOfStock()).isEqualTo(1);
    }

    private static BrewStoreStockUsageDay day(int offset, int qty) {
        return new BrewStoreStockUsageDay(1, LocalDate.of(2026, 8, offset), qty);
    }
}
