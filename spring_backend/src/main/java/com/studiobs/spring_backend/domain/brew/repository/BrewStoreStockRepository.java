package com.studiobs.spring_backend.domain.brew.repository;

import com.studiobs.spring_backend.domain.brew.entity.BrewStoreStock;
import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BrewStoreStockRepository extends JpaRepository<BrewStoreStock, Integer> {

    List<BrewStoreStock> findByCategoryIdOrderByStockNameAsc(Integer categoryId);

    List<BrewStoreStock> findByCategoryIdInOrderByStockNameAsc(Collection<Integer> categoryIds);

    boolean existsByCategoryIdAndStockName(Integer categoryId, String stockName);
}
