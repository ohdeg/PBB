package com.studiobs.spring_backend.domain.user.repository;

import com.studiobs.spring_backend.domain.user.entity.User;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserRepository extends JpaRepository<User, UUID> {

    boolean existsByEmail(String email);

    boolean existsByNickname(String nickname);

    Optional<User> findByEmail(String email);

    Optional<User> findByNickname(String nickname);

    List<User> findTop20ByEmailContainingIgnoreCaseOrNicknameContainingIgnoreCaseOrderByNicknameAsc(
            String email,
            String nickname
    );
}
