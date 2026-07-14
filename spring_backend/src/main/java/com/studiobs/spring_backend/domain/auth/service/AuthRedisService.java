package com.studiobs.spring_backend.domain.auth.service;

import com.studiobs.spring_backend.global.config.JwtProperties;
import java.time.Duration;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class AuthRedisService {

    private static final String SIGNUP_CODE_PREFIX = "signup:";
    private static final String SIGNUP_VERIFIED_PREFIX = "signup_verified:";
    private static final String REFRESH_TOKEN_PREFIX = "RT:";
    private static final Duration SIGNUP_CODE_TTL = Duration.ofMinutes(3);
    private static final Duration SIGNUP_VERIFIED_TTL = Duration.ofMinutes(10);

    private final StringRedisTemplate stringRedisTemplate;
    private final JwtProperties jwtProperties;

    public void saveSignupCode(String email, String code) {
        stringRedisTemplate.opsForValue()
                .set(signupCodeKey(email), code, SIGNUP_CODE_TTL);
    }

    public Optional<String> getSignupCode(String email) {
        return Optional.ofNullable(
                stringRedisTemplate.opsForValue().get(signupCodeKey(email)));
    }

    public void deleteSignupCode(String email) {
        stringRedisTemplate.delete(signupCodeKey(email));
    }

    public void markSignupVerified(String email) {
        stringRedisTemplate.opsForValue()
                .set(signupVerifiedKey(email), "true", SIGNUP_VERIFIED_TTL);
    }

    public boolean isSignupVerified(String email) {
        return Boolean.TRUE.equals(stringRedisTemplate.hasKey(signupVerifiedKey(email)));
    }

    public void deleteSignupVerified(String email) {
        stringRedisTemplate.delete(signupVerifiedKey(email));
    }

    public void saveRefreshToken(String email, String refreshToken) {
        stringRedisTemplate.opsForValue().set(
                refreshTokenKey(email),
                refreshToken,
                jwtProperties.refreshTokenExpiry()
        );
    }

    public Optional<String> getRefreshToken(String email) {
        return Optional.ofNullable(
                stringRedisTemplate.opsForValue().get(refreshTokenKey(email)));
    }

    public boolean matchesRefreshToken(String email, String refreshToken) {
        return getRefreshToken(email)
                .map(saved -> saved.equals(refreshToken))
                .orElse(false);
    }

    public void deleteRefreshToken(String email) {
        stringRedisTemplate.delete(refreshTokenKey(email));
    }

    private String signupCodeKey(String email) {
        return SIGNUP_CODE_PREFIX + email;
    }

    private String signupVerifiedKey(String email) {
        return SIGNUP_VERIFIED_PREFIX + email;
    }

    private String refreshTokenKey(String email) {
        return REFRESH_TOKEN_PREFIX + email;
    }
}
