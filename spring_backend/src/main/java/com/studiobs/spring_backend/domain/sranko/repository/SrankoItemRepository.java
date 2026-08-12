package com.studiobs.spring_backend.domain.sranko.repository;

import com.studiobs.spring_backend.domain.sranko.entity.SrankoItem;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SrankoItemRepository extends JpaRepository<SrankoItem, UUID> {

    List<SrankoItem> findByUserIdOrderByCreatedAtDesc(UUID userId);

    Optional<SrankoItem> findByIdAndUserId(UUID id, UUID userId);

    void deleteByIdAndUserId(UUID id, UUID userId);
}
