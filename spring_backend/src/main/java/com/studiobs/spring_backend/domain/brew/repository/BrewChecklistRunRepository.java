package com.studiobs.spring_backend.domain.brew.repository;

import com.studiobs.spring_backend.domain.brew.entity.BrewChecklistRun;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BrewChecklistRunRepository extends JpaRepository<BrewChecklistRun, UUID> {

    Optional<BrewChecklistRun> findByTemplateIdAndRunOn(UUID templateId, LocalDate runOn);

    List<BrewChecklistRun> findByTemplateIdInAndRunOn(Collection<UUID> templateIds, LocalDate runOn);
}
