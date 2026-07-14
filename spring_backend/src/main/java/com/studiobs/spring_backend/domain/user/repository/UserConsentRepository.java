package com.studiobs.spring_backend.domain.user.repository;

import com.studiobs.spring_backend.domain.user.entity.UserConsent;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserConsentRepository extends JpaRepository<UserConsent, UUID> {
}
