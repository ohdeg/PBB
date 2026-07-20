package com.studiobs.spring_backend.domain.lotto.repository;

import com.studiobs.spring_backend.domain.lotto.entity.LottoDraw;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface LottoDrawRepository extends JpaRepository<LottoDraw, Integer> {

    List<LottoDraw> findAllByOrderByRoundAsc();

    Optional<LottoDraw> findTopByOrderByRoundDesc();
}
