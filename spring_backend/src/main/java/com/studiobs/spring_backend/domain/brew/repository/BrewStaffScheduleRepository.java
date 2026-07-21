package com.studiobs.spring_backend.domain.brew.repository;

import com.studiobs.spring_backend.domain.brew.entity.BrewStaffSchedule;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BrewStaffScheduleRepository extends JpaRepository<BrewStaffSchedule, UUID> {

    List<BrewStaffSchedule> findByStoreIdOrderByUserIdAscDayOfWeekAsc(UUID storeId);

    List<BrewStaffSchedule> findByStoreIdAndUserIdOrderByDayOfWeekAsc(UUID storeId, UUID userId);

    Optional<BrewStaffSchedule> findByStoreIdAndUserIdAndDayOfWeek(
            UUID storeId,
            UUID userId,
            int dayOfWeek
    );

    void deleteByStoreIdAndUserIdAndDayOfWeek(UUID storeId, UUID userId, int dayOfWeek);

    void deleteByStoreIdAndUserId(UUID storeId, UUID userId);
}
