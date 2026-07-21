package com.studiobs.spring_backend.domain.config.repository;

import com.studiobs.spring_backend.domain.config.entity.AppConfig;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AppConfigRepository extends JpaRepository<AppConfig, String> {
}
