package com.studiobs.spring_backend.domain.dev.service;

import com.studiobs.spring_backend.domain.auth.service.AuthRedisService;
import com.studiobs.spring_backend.domain.config.service.AppConfigService;
import com.studiobs.spring_backend.domain.user.dto.UserResponse;
import com.studiobs.spring_backend.domain.user.entity.User;
import com.studiobs.spring_backend.domain.user.entity.UserClass;
import com.studiobs.spring_backend.domain.user.service.UserService;
import com.studiobs.spring_backend.global.exception.BusinessException;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import org.springframework.jdbc.core.JdbcTemplate;
import com.studiobs.spring_backend.domain.config.entity.AppConfig;
import com.studiobs.spring_backend.domain.dev.operations.OperationsLog;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class DevAdminService {

    private final UserService userService;
    private final AuthRedisService authRedisService;
    private final AppConfigService appConfigService;

    private final EntityManager em;
    private final OperationsLog events;
    private final JdbcTemplate db;

    @Transactional(readOnly = true)
    public OperationsLog.Today today(String actorEmail, Long cursor) {
        requireDev(actorEmail);
        return events.today(cursor);
    }

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
        User actor = requireDev(actorEmail);

        User target = findTargetUser(query)
                .orElseThrow(() -> new BusinessException(
                        HttpStatus.NOT_FOUND,
                        "닉네임 또는 이메일로 회원을 찾을 수 없습니다."));

        em.refresh(target, LockModeType.PESSIMISTIC_WRITE);
        var before = target.getUserClass();
        if (target.getUserClass() == userClass) {
            return UserResponse.from(target);
        }

        UserResponse updated = userService.updateUserClass(target, userClass);
        events.audit(actor.getId(), "USER_CLASS", target.getId().toString(), before.name(), userClass.name());
        authRedisService.deleteRefreshToken(normalizeEmail(target.getEmail()));
        return updated;
    }

    @Transactional
    public List<String> updateFeaturedApps(String actorEmail, List<String> appIds) {
        User actor = requireDev(actorEmail);
        // Ensure the singleton exists and serialize competing writers even on its first update.
        db.update("INSERT INTO app_config(config_key,config_value) VALUES (?,?) "
                + "ON DUPLICATE KEY UPDATE config_key=config_key",
                AppConfigService.KEY_FEATURED_APP_ID, AppConfigService.DEFAULT_FEATURED_APP_ID);
        em.find(AppConfig.class, AppConfigService.KEY_FEATURED_APP_ID, LockModeType.PESSIMISTIC_WRITE);
        var before = appConfigService.getFeaturedAppIds();
        var after = appConfigService.setFeaturedAppIds(appIds);
        if (!before.equals(after)) {
            events.audit(actor.getId(), "FEATURED_APPS", "PBB", safeAppNames(before), safeAppNames(after));
        }
        return after;
    }

    private static final Set<String> APP_IDS = Set.of("veveno", "tempori", "sranko", "6pick", "dieta");

    private static String safeAppNames(List<String> ids) {
        return ids.stream().map(id -> APP_IDS.contains(id) ? id : "기타").collect(Collectors.joining(", "));
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
