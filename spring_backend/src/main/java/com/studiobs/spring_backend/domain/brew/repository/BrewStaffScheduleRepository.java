package com.studiobs.spring_backend.domain.brew.repository;

import com.studiobs.spring_backend.domain.brew.entity.BrewStaffSchedule;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BrewStaffScheduleRepository extends JpaRepository<BrewStaffSchedule, UUID> {

    List<BrewStaffSchedule> findByStoreIdOrderByUserIdAscDayOfWeekAsc(UUID storeId);

    List<BrewStaffSchedule> findByStoreIdAndUserIdOrderByDayOfWeekAsc(UUID storeId, UUID userId);

    List<BrewStaffSchedule> findByStoreIdInAndUserId(Collection<UUID> storeIds, UUID userId);

    void deleteByStoreIdAndUserId(UUID storeId, UUID userId);
}
