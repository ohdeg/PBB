package com.studiobs.spring_backend.domain.tempori;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import java.util.Optional;
public interface TemporiStateMutationRepository extends JpaRepository<TemporiStateMutation,String> {
    Optional<TemporiStateMutation> findByScoreIdAndMutationId(String scoreId,String mutationId);
    @Modifying @Query("delete from TemporiStateMutation m where m.scoreId=:id")
    void deleteByScoreId(@Param("id") String scoreId);
    @Modifying @Query(value="DELETE FROM tempori_state_mutations WHERE score_id=:id AND id NOT IN (SELECT id FROM (SELECT id FROM tempori_state_mutations WHERE score_id=:id ORDER BY updated_at DESC,id DESC LIMIT 1000) recent)",nativeQuery=true)
    void retainRecent(@Param("id") String scoreId);
}
