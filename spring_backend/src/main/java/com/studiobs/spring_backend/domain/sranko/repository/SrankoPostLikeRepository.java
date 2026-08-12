package com.studiobs.spring_backend.domain.sranko.repository;

import com.studiobs.spring_backend.domain.sranko.entity.SrankoPostLike;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface SrankoPostLikeRepository extends JpaRepository<SrankoPostLike, UUID> {

    boolean existsByPostIdAndUserId(UUID postId, UUID userId);

    void deleteByPostIdAndUserId(UUID postId, UUID userId);

    @Query("select l.postId from SrankoPostLike l where l.userId = :userId and l.postId in :postIds")
    List<UUID> findPostIdsByUserIdAndPostIdIn(
            @Param("userId") UUID userId,
            @Param("postIds") Collection<UUID> postIds
    );
}
