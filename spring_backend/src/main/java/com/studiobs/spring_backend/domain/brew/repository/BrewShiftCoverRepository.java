package com.studiobs.spring_backend.domain.brew.repository;

import com.studiobs.spring_backend.domain.brew.entity.BrewShiftCover;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface BrewShiftCoverRepository extends JpaRepository<BrewShiftCover, UUID> {

    List<BrewShiftCover> findByStoreIdAndWorkDateBetweenOrderByWorkDateAscStartTimeAsc(
            UUID storeId,
            LocalDate from,
            LocalDate to
    );

    List<BrewShiftCover> findByStoreIdAndStatusInOrderByWorkDateAscStartTimeAsc(
            UUID storeId,
            Collection<String> statuses
    );

    @Query("""
            SELECT c FROM BrewShiftCover c
            WHERE c.storeId = :storeId
              AND c.workDate > :leaveDate
              AND c.status IN :statuses
              AND (
                c.originalUserId = :userId
                OR c.coverUserId = :userId
                OR c.requestedByUserId = :userId
              )
            """)
    List<BrewShiftCover> findInvolvingUserAfterLeaveDate(
            @Param("storeId") UUID storeId,
            @Param("userId") UUID userId,
            @Param("leaveDate") LocalDate leaveDate,
            @Param("statuses") Collection<String> statuses
    );

    List<BrewShiftCover> findByStoreIdAndOriginalUserIdAndWorkDateAndStatusIn(
            UUID storeId,
            UUID originalUserId,
            LocalDate workDate,
            Collection<String> statuses
    );

    List<BrewShiftCover> findByStoreIdAndCoverUserIdAndWorkDateInAndStatus(
            UUID storeId,
            UUID coverUserId,
            Collection<LocalDate> workDates,
            String status
    );

    List<BrewShiftCover> findByStoreIdAndOriginalUserIdAndWorkDateInAndStatus(
            UUID storeId,
            UUID originalUserId,
            Collection<LocalDate> workDates,
            String status
    );
}
