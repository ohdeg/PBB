package com.studiobs.spring_backend.domain.tempori;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import java.util.*;
public interface TemporiScoreStateRepository extends JpaRepository<TemporiScoreState,String> {
    Optional<TemporiScoreState> findByScoreIdAndDocumentKey(String scoreId,String documentKey);
    List<TemporiScoreState> findByScoreIdOrderByDocumentKey(String scoreId);
    @Modifying @Query("delete from TemporiScoreState s where s.scoreId=:id")
    void deleteByScoreId(@Param("id") String scoreId);
}
