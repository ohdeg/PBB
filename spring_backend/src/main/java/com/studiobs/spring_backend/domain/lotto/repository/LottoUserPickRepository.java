package com.studiobs.spring_backend.domain.lotto.repository;

import com.studiobs.spring_backend.domain.lotto.entity.LottoUserPick;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface LottoUserPickRepository extends JpaRepository<LottoUserPick, UUID> {
}
