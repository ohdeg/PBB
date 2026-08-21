package com.studiobs.spring_backend.domain.brew.repository;

import com.studiobs.spring_backend.domain.brew.entity.BrewStaffScheduleOverride;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BrewStaffScheduleOverrideRepository
        extends JpaRepository<BrewStaffScheduleOverride, UUID> {

    List<BrewStaffScheduleOverride> findByStoreIdAndWorkDateBetween(
            UUID storeId,
            LocalDate from,
            LocalDate to
    );

    List<BrewStaffScheduleOverride> findByStoreIdAndUserIdAndWorkDateBetween(
            UUID storeId,
            UUID userId,
            LocalDate from,
            LocalDate to
    );

    List<BrewStaffScheduleOverride> findByStoreIdInAndUserIdAndWorkDateIn(
            Collection<UUID> storeIds,
            UUID userId,
            Collection<LocalDate> workDates
    );

    List<BrewStaffScheduleOverride> findByStoreIdAndUserIdAndWorkDateIn(
            UUID storeId,
            UUID userId,
            Collection<LocalDate> workDates
    );

    Optional<BrewStaffScheduleOverride> findByStoreIdAndUserIdAndWorkDate(
            UUID storeId,
            UUID userId,
            LocalDate workDate
    );

    void deleteByStoreIdAndUserId(UUID storeId, UUID userId);
}
