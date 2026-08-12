package com.studiobs.spring_backend.domain.sranko.repository;

import com.studiobs.spring_backend.domain.sranko.entity.SrankoLook;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SrankoLookRepository extends JpaRepository<SrankoLook, UUID> {

    List<SrankoLook> findByUserIdOrderByCreatedAtDesc(UUID userId);

    Optional<SrankoLook> findByIdAndUserId(UUID id, UUID userId);

    void deleteByIdAndUserId(UUID id, UUID userId);
}
