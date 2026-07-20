package com.studiobs.spring_backend.domain.brew.repository;

import com.studiobs.spring_backend.domain.brew.entity.BrewMenu;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BrewMenuRepository extends JpaRepository<BrewMenu, UUID> {

    List<BrewMenu> findByStoreIdOrderByCreatedAtAsc(UUID storeId);
}
