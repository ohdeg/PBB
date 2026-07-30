package com.studiobs.spring_backend.domain.dieta.repository;

import com.studiobs.spring_backend.domain.dieta.entity.DietaRecipe;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DietaRecipeRepository extends JpaRepository<DietaRecipe, UUID> {

    List<DietaRecipe> findByUserIdAndLoggedOnOrderByCreatedAtAsc(UUID userId, LocalDate loggedOn);

    List<DietaRecipe> findTop100ByUserIdOrderByCreatedAtDescIdDesc(UUID userId);
}
