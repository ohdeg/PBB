package com.studiobs.spring_backend.domain.dieta.repository;

import com.studiobs.spring_backend.domain.dieta.entity.DietaProfile;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DietaProfileRepository extends JpaRepository<DietaProfile, UUID> {
}
