package com.studiobs.spring_backend.domain.brew.repository;

import com.studiobs.spring_backend.domain.brew.entity.BrewStore;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface BrewStoreRepository extends JpaRepository<BrewStore, UUID> {

    List<BrewStore> findByOwnerUserIdOrderByUpdatedAtDesc(UUID ownerUserId);

    List<BrewStore> findByIsPublicTrueOrderByUpdatedAtDesc();

    List<BrewStore> findByNameContainingIgnoreCaseOrderByUpdatedAtDesc(String name);

    Optional<BrewStore> findByInviteCodeIgnoreCase(String inviteCode);

    boolean existsByInviteCodeIgnoreCase(String inviteCode);

    @Query("select count(distinct s.ownerUserId) from BrewStore s")
    long countDistinctOwners();
}
