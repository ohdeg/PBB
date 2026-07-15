package com.studiobs.spring_backend.domain.dev.service;

import com.studiobs.spring_backend.domain.auth.service.AuthRedisService;
import com.studiobs.spring_backend.domain.user.dto.UserResponse;
import com.studiobs.spring_backend.domain.user.entity.User;
import com.studiobs.spring_backend.domain.user.entity.UserClass;
import com.studiobs.spring_backend.domain.user.service.UserService;
import com.studiobs.spring_backend.global.exception.BusinessException;
import java.util.List;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class DevAdminService {

    private final UserService userService;
    private final AuthRedisService authRedisService;

    @Transactional(readOnly = true)
    public List<UserResponse> searchUsers(String actorEmail, String query) {
        requireDev(actorEmail);

        String trimmed = query == null ? "" : query.trim();
        if (trimmed.length() < 1) {
            return List.of();
        }

        return userService.searchByEmailOrNickname(trimmed).stream()
                .map(UserResponse::from)
                .toList();
    }

    @Transactional
    public UserResponse updateUserClass(String actorEmail, String query, UserClass userClass) {
        requireDev(actorEmail);

        User target = findTargetUser(query)
                .orElseThrow(() -> new BusinessException(
                        HttpStatus.NOT_FOUND,
                        "닉네임 또는 이메일로 회원을 찾을 수 없습니다."));

        if (target.getUserClass() == userClass) {
            return UserResponse.from(target);
        }

        UserResponse updated = userService.updateUserClass(target, userClass);
        authRedisService.deleteRefreshToken(normalizeEmail(target.getEmail()));
        return updated;
    }

    private User requireDev(String actorEmail) {
        User actor = userService.findByEmail(normalizeEmail(actorEmail))
                .orElseThrow(() -> new BusinessException(HttpStatus.UNAUTHORIZED, "로그인이 필요합니다."));

        if (!actor.getUserClass().isDev()) {
            throw new BusinessException(HttpStatus.FORBIDDEN, "DEV 등급만 회원 등급을 변경할 수 있습니다.");
        }
        return actor;
    }

    private Optional<User> findTargetUser(String query) {
        String trimmed = query.trim();
        if (trimmed.isEmpty()) {
            return Optional.empty();
        }

        Optional<User> byEmail = userService.findByEmail(normalizeEmail(trimmed));
        if (byEmail.isPresent()) {
            return byEmail;
        }

        return userService.findByNickname(trimmed);
    }

    private String normalizeEmail(String email) {
        return email.trim().toLowerCase();
    }
}
