package com.studiobs.spring_backend.domain.dieta.repository;

import com.studiobs.spring_backend.domain.dieta.entity.DietaProfile;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DietaProfileRepository extends JpaRepository<DietaProfile, UUID> {
    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("select p from DietaProfile p where p.userId = :userId")
    java.util.Optional<DietaProfile> findLockedByUserId(@org.springframework.data.repository.query.Param("userId") UUID userId);
}
