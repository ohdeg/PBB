package com.studiobs.spring_backend.domain.lotto.repository;

import com.studiobs.spring_backend.domain.lotto.dto.LottoDrawSnapshot;
import com.studiobs.spring_backend.domain.lotto.entity.LottoDraw;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface LottoDrawRepository extends JpaRepository<LottoDraw, Integer> {

    List<LottoDraw> findAllByOrderByRoundAsc();

    Optional<LottoDraw> findTopByOrderByRoundDesc();

    @Query("select new com.studiobs.spring_backend.domain.lotto.dto.LottoDrawSnapshot("
            + "d.round, d.bonusNumber, d.drawDate, d.firstPrizeAmount, d.firstPrizeWinnerCount) "
            + "from LottoDraw d")
    List<LottoDrawSnapshot> findAllSnapshots();
}
