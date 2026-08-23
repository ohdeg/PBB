package com.studiobs.spring_backend.domain.brew.repository;

import com.studiobs.spring_backend.domain.brew.entity.BrewChecklistCheck;
import com.studiobs.spring_backend.domain.brew.entity.BrewChecklistCheckId;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BrewChecklistCheckRepository
        extends JpaRepository<BrewChecklistCheck, BrewChecklistCheckId> {

    List<BrewChecklistCheck> findByRunIdIn(Collection<UUID> runIds);
}
