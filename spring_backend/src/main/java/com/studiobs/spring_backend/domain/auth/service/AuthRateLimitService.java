package com.studiobs.spring_backend.domain.auth.service;

import com.studiobs.spring_backend.global.exception.BusinessException;
import java.time.Duration;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

/**
 * 인증 API rate limit (IP + 이메일 각각).
 * <ul>
 *   <li>발송: 60초 쿨다운 + 10분 5회</li>
 *   <li>검증: 10분 10회</li>
 *   <li>로그인: 10분 10회</li>
 * </ul>
 */
@Service
@RequiredArgsConstructor
public class AuthRateLimitService {

    private static final Duration SEND_COOLDOWN = Duration.ofSeconds(60);
    private static final Duration WINDOW = Duration.ofMinutes(10);
    private static final int SEND_WINDOW_LIMIT = 5;
    private static final int VERIFY_WINDOW_LIMIT = 10;
    private static final int LOGIN_WINDOW_LIMIT = 10;

    private static final String SEND_COOLDOWN_PREFIX = "rl:auth:send:cd:";
    private static final String SEND_WINDOW_PREFIX = "rl:auth:send:win:";
    private static final String VERIFY_WINDOW_PREFIX = "rl:auth:verify:win:";
    private static final String LOGIN_WINDOW_PREFIX = "rl:auth:login:win:";
    private static final String POS_PAIR_WINDOW_PREFIX = "rl:veveno:pos:pair:ip:";
    private static final int POS_PAIR_WINDOW_LIMIT = 30;

    private static final String MSG_COOLDOWN = "1분 뒤에 다시 보내 주세요.";
    private static final String MSG_TOO_MANY = "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.";

    private final StringRedisTemplate stringRedisTemplate;

    public void checkEmailSend(String email, String clientIp) {
        assertSendAllowed("email:" + email);
        assertSendAllowed("ip:" + sanitize(clientIp));
    }

    public void checkEmailVerify(String email, String clientIp) {
        assertWindow(VERIFY_WINDOW_PREFIX + "email:" + email, VERIFY_WINDOW_LIMIT);
        assertWindow(VERIFY_WINDOW_PREFIX + "ip:" + sanitize(clientIp), VERIFY_WINDOW_LIMIT);
    }

    public void checkLogin(String email, String clientIp) {
        assertWindow(LOGIN_WINDOW_PREFIX + "email:" + email, LOGIN_WINDOW_LIMIT);
        assertWindow(LOGIN_WINDOW_PREFIX + "ip:" + sanitize(clientIp), LOGIN_WINDOW_LIMIT);
    }

    public void checkPosPair(String clientIp) {
        assertWindow(POS_PAIR_WINDOW_PREFIX + sanitize(clientIp), POS_PAIR_WINDOW_LIMIT);
    }

    private void assertSendAllowed(String subjectKey) {
        String cooldownKey = SEND_COOLDOWN_PREFIX + subjectKey;
        Boolean acquired = stringRedisTemplate.opsForValue()
                .setIfAbsent(cooldownKey, "1", SEND_COOLDOWN);
        if (Boolean.FALSE.equals(acquired)) {
            throw new BusinessException(HttpStatus.TOO_MANY_REQUESTS, MSG_COOLDOWN);
        }
        assertWindow(SEND_WINDOW_PREFIX + subjectKey, SEND_WINDOW_LIMIT);
    }

    private void assertWindow(String key, int limit) {
        Long count = stringRedisTemplate.opsForValue().increment(key);
        if (count != null && count == 1L) {
            stringRedisTemplate.expire(key, WINDOW);
        }
        if (count != null && count > limit) {
            throw new BusinessException(HttpStatus.TOO_MANY_REQUESTS, MSG_TOO_MANY);
        }
    }

    private static String sanitize(String value) {
        if (value == null || value.isBlank()) {
            return "unknown";
        }
        return value.trim().replaceAll("[^a-zA-Z0-9:._-]", "_");
    }
}
