package com.studiobs.spring_backend.domain.brew.repository;

import com.studiobs.spring_backend.domain.brew.entity.BrewStoreStockLog;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BrewStoreStockLogRepository extends JpaRepository<BrewStoreStockLog, Integer> {

    List<BrewStoreStockLog> findTop50ByStockIdOrderByIdDesc(Integer stockId);
}
