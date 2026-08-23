package com.studiobs.spring_backend.domain.brew.repository;

import com.studiobs.spring_backend.domain.brew.entity.BrewChecklistTemplate;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface BrewChecklistTemplateRepository
        extends JpaRepository<BrewChecklistTemplate, UUID> {

    @Query("""
            SELECT t FROM BrewChecklistTemplate t
            WHERE t.storeId = :storeId
              AND (t.ownerUserId IS NULL OR t.ownerUserId = :userId)
            ORDER BY t.sortOrder ASC, t.title ASC
            """)
    List<BrewChecklistTemplate> findVisibleForMember(
            @Param("storeId") UUID storeId,
            @Param("userId") UUID userId
    );
}
