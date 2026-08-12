package com.studiobs.spring_backend.domain.sranko.repository;

import com.studiobs.spring_backend.domain.sranko.entity.SrankoPrefs;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SrankoPrefsRepository extends JpaRepository<SrankoPrefs, UUID> {
}
