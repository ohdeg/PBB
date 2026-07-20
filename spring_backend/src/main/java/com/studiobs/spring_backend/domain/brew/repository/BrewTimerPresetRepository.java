package com.studiobs.spring_backend.domain.brew.repository;

import com.studiobs.spring_backend.domain.brew.entity.BrewTimerPreset;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BrewTimerPresetRepository extends JpaRepository<BrewTimerPreset, UUID> {

    List<BrewTimerPreset> findByScopeAndUserIdOrderByUpdatedAtDesc(String scope, UUID userId);

    List<BrewTimerPreset> findByScopeAndStoreIdOrderByUpdatedAtDesc(String scope, UUID storeId);
}
