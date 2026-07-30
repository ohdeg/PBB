package com.studiobs.spring_backend.domain.dieta.repository;

import com.studiobs.spring_backend.domain.dieta.entity.DietaCheckInLog;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DietaCheckInLogRepository extends JpaRepository<DietaCheckInLog, UUID> {

    List<DietaCheckInLog> findByUserIdOrderByLoggedOnAsc(UUID userId);

    Optional<DietaCheckInLog> findByUserIdAndLoggedOn(UUID userId, LocalDate loggedOn);

    void deleteByUserId(UUID userId);
}
