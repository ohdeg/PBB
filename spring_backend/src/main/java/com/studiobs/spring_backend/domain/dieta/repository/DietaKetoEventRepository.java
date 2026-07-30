package com.studiobs.spring_backend.domain.dieta.repository;

import com.studiobs.spring_backend.domain.dieta.entity.DietaKetoEvent;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DietaKetoEventRepository extends JpaRepository<DietaKetoEvent, UUID> {

    List<DietaKetoEvent> findByUserIdOrderByRecordedAtDesc(UUID userId);

    void deleteByUserId(UUID userId);
}
