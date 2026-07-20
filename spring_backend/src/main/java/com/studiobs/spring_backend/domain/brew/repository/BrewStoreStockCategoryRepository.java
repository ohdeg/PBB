package com.studiobs.spring_backend.domain.brew.repository;

import com.studiobs.spring_backend.domain.brew.entity.BrewStoreStockCategory;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BrewStoreStockCategoryRepository extends JpaRepository<BrewStoreStockCategory, Integer> {

    List<BrewStoreStockCategory> findByStoreIdOrderByCategoryNameAsc(UUID storeId);

    boolean existsByStoreIdAndCategoryName(UUID storeId, String categoryName);
}
