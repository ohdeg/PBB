package com.studiobs.spring_backend.domain.dieta.repository;

import com.studiobs.spring_backend.domain.dieta.entity.DietaActivityLog;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DietaActivityLogRepository extends JpaRepository<DietaActivityLog, UUID> {

    List<DietaActivityLog> findByUserIdOrderByLoggedOnAsc(UUID userId);

    Optional<DietaActivityLog> findByUserIdAndLoggedOn(UUID userId, LocalDate loggedOn);
}
