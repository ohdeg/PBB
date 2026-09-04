package com.studiobs.spring_backend.domain.brew.repository;

import com.studiobs.spring_backend.domain.brew.entity.BrewStoreNotice;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BrewStoreNoticeRepository extends JpaRepository<BrewStoreNotice, UUID> {

    List<BrewStoreNotice> findByStoreIdOrderByCreatedAtDesc(UUID storeId);

    List<BrewStoreNotice> findByStoreIdInOrderByCreatedAtDesc(Collection<UUID> storeIds);

    long countByStoreId(UUID storeId);
}
