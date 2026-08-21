package com.studiobs.spring_backend.domain.brew.repository;

import com.studiobs.spring_backend.domain.brew.entity.BrewStoreStockUsageDay;
import com.studiobs.spring_backend.domain.brew.entity.BrewStoreStockUsageDayId;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BrewStoreStockUsageDayRepository
        extends JpaRepository<BrewStoreStockUsageDay, BrewStoreStockUsageDayId> {

    List<BrewStoreStockUsageDay> findByStockIdInAndUsedOnGreaterThanEqual(
            Collection<Integer> stockIds,
            LocalDate from
    );

    List<BrewStoreStockUsageDay> findByStockIdAndUsedOnGreaterThanEqual(Integer stockId, LocalDate from);

    Optional<BrewStoreStockUsageDay> findByStockIdAndUsedOn(Integer stockId, LocalDate usedOn);
}
