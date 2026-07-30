package com.studiobs.spring_backend.domain.dieta.repository;

import com.studiobs.spring_backend.domain.dieta.entity.DietaIntakeLog;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DietaIntakeLogRepository extends JpaRepository<DietaIntakeLog, UUID> {

    List<DietaIntakeLog> findByUserIdOrderByLoggedOnAsc(UUID userId);

    Optional<DietaIntakeLog> findByUserIdAndLoggedOn(UUID userId, LocalDate loggedOn);
}
