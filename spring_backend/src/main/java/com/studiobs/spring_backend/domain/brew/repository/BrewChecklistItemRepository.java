package com.studiobs.spring_backend.domain.brew.repository;

import com.studiobs.spring_backend.domain.brew.entity.BrewChecklistItem;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BrewChecklistItemRepository extends JpaRepository<BrewChecklistItem, Integer> {

    List<BrewChecklistItem> findByTemplateIdInOrderBySortOrderAscIdAsc(Collection<UUID> templateIds);

    List<BrewChecklistItem> findByTemplateIdOrderBySortOrderAscIdAsc(UUID templateId);

    void deleteByTemplateId(UUID templateId);
}
