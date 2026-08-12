package com.studiobs.spring_backend.domain.sranko.repository;

import com.studiobs.spring_backend.domain.sranko.entity.SrankoPostCommentLike;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface SrankoPostCommentLikeRepository extends JpaRepository<SrankoPostCommentLike, UUID> {

    boolean existsByCommentIdAndUserId(UUID commentId, UUID userId);

    void deleteByCommentIdAndUserId(UUID commentId, UUID userId);

    @Query("select l.commentId from SrankoPostCommentLike l where l.userId = :userId and l.commentId in :commentIds")
    List<UUID> findCommentIdsByUserIdAndCommentIdIn(
            @Param("userId") UUID userId,
            @Param("commentIds") Collection<UUID> commentIds
    );
}
