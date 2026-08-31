package com.studiobs.spring_backend.domain.brew.repository;

import com.studiobs.spring_backend.domain.brew.entity.BrewPosDevice;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BrewPosDeviceRepository extends JpaRepository<BrewPosDevice, UUID> {

    List<BrewPosDevice> findByStoreIdOrderByCreatedAtAsc(UUID storeId);

    Optional<BrewPosDevice> findByStoreIdAndDeviceId(UUID storeId, String deviceId);

    Optional<BrewPosDevice> findFirstByDeviceId(String deviceId);

    boolean existsByStoreIdAndDeviceId(UUID storeId, String deviceId);

    long countByStoreId(UUID storeId);

    void deleteByStoreIdAndDeviceId(UUID storeId, String deviceId);
}
