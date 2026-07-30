package com.studiobs.spring_backend.domain.dieta.repository;

import com.studiobs.spring_backend.domain.dieta.entity.DietaBodyLog;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DietaBodyLogRepository extends JpaRepository<DietaBodyLog, UUID> {

    List<DietaBodyLog> findByUserIdOrderByLoggedOnAsc(UUID userId);

    Optional<DietaBodyLog> findByUserIdAndLoggedOn(UUID userId, LocalDate loggedOn);
}
