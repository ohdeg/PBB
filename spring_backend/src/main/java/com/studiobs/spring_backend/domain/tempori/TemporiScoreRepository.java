package com.studiobs.spring_backend.domain.tempori;
import jakarta.persistence.LockModeType;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import org.springframework.data.domain.Pageable;
public interface TemporiScoreRepository extends JpaRepository<TemporiScore,String> {
    Optional<TemporiScore> findByOwnerIdAndIdempotencyKey(String ownerId, String key);
    List<TemporiScore> findByOwnerIdOrderByCreatedAtDesc(String ownerId);
    @Lock(LockModeType.PESSIMISTIC_WRITE) @Query("select s from TemporiScore s where s.ownerId=:owner order by s.id")
    List<TemporiScore> lockAllByOwner(@Param("owner") String owner);
    @Lock(LockModeType.PESSIMISTIC_WRITE) @Query("select s from TemporiScore s where s.id=:id")
    Optional<TemporiScore> lockById(@Param("id") String id);
    @Query("select s from TemporiScore s where (s.state=:deleting and (s.cleanupAfter is null or s.cleanupAfter<=:now)) or (s.state in :abandoned and s.updatedAt<:cutoff) order by s.updatedAt,s.id")
    List<TemporiScore> cleanupCandidates(@Param("cutoff") Instant cutoff,@Param("now") Instant now,@Param("deleting") TemporiScore.State deleting,@Param("abandoned") List<TemporiScore.State> abandoned,Pageable pageable);
}
