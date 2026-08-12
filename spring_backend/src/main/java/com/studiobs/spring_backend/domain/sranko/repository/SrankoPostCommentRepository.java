package com.studiobs.spring_backend.domain.sranko.repository;

import com.studiobs.spring_backend.domain.sranko.entity.SrankoPostComment;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface SrankoPostCommentRepository extends JpaRepository<SrankoPostComment, UUID> {

    List<SrankoPostComment> findByPostIdOrderByCreatedAtAsc(UUID postId);

    @Query("""
            select count(c) from SrankoPostComment c
            where c.postId = :postId and (c.id = :rootId or c.parentId = :rootId)
            """)
    long countSubtree(@Param("postId") UUID postId, @Param("rootId") UUID rootId);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("update SrankoPostComment c set c.likeCount = c.likeCount + 1 where c.id = :id")
    int incrementLikeCount(@Param("id") UUID id);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("update SrankoPostComment c set c.likeCount = c.likeCount - 1 where c.id = :id and c.likeCount > 0")
    int decrementLikeCount(@Param("id") UUID id);
}
