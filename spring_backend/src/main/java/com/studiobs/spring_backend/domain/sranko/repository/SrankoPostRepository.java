package com.studiobs.spring_backend.domain.sranko.repository;

import com.studiobs.spring_backend.domain.sranko.entity.SrankoPost;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface SrankoPostRepository extends JpaRepository<SrankoPost, UUID> {

    java.util.List<SrankoPost> findAllByOrderByCreatedAtDesc();

    java.util.List<SrankoPost> findAllByOrderByReadCountDescCreatedAtDesc();

    java.util.List<SrankoPost> findByAuthorUserIdOrderByCreatedAtDesc(UUID authorUserId);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("update SrankoPost p set p.readCount = p.readCount + 1 where p.id = :id")
    int incrementReadCount(@Param("id") UUID id);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("update SrankoPost p set p.likeCount = p.likeCount + 1 where p.id = :id")
    int incrementLikeCount(@Param("id") UUID id);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("update SrankoPost p set p.likeCount = p.likeCount - 1 where p.id = :id and p.likeCount > 0")
    int decrementLikeCount(@Param("id") UUID id);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("update SrankoPost p set p.commentCount = p.commentCount + 1 where p.id = :id")
    int incrementCommentCount(@Param("id") UUID id);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("update SrankoPost p set p.commentCount = p.commentCount - :delta where p.id = :id and p.commentCount >= :delta")
    int decrementCommentCount(@Param("id") UUID id, @Param("delta") int delta);
}
