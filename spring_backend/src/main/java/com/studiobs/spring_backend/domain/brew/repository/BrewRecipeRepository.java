package com.studiobs.spring_backend.domain.brew.repository;

import com.studiobs.spring_backend.domain.brew.entity.BrewRecipe;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BrewRecipeRepository extends JpaRepository<BrewRecipe, UUID> {

    List<BrewRecipe> findByMenuIdOrderByCreatedAtAsc(UUID menuId);
}
