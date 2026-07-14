package com.studiobs.spring_backend.domain.auth.support;

import com.studiobs.spring_backend.global.config.CookieProperties;
import com.studiobs.spring_backend.global.config.JwtProperties;
import java.time.Duration;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class RefreshTokenCookieFactory {

    private final CookieProperties cookieProperties;
    private final JwtProperties jwtProperties;

    public ResponseCookie create(String refreshToken) {
        return baseBuilder(refreshToken)
                .maxAge(jwtProperties.refreshTokenExpiry())
                .build();
    }

    public ResponseCookie clear() {
        return baseBuilder("")
                .maxAge(Duration.ZERO)
                .build();
    }

    private ResponseCookie.ResponseCookieBuilder baseBuilder(String value) {
        return ResponseCookie.from(cookieProperties.refreshTokenName(), value)
                .httpOnly(true)
                .secure(cookieProperties.secure())
                .sameSite(cookieProperties.sameSite())
                .path(cookieProperties.path());
    }
}
