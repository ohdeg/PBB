package com.studiobs.spring_backend.domain.auth.controller;

import com.studiobs.spring_backend.domain.auth.dto.EmailRequest;
import com.studiobs.spring_backend.domain.auth.dto.EmailVerifyRequest;
import com.studiobs.spring_backend.domain.auth.dto.LoginRequest;
import com.studiobs.spring_backend.domain.auth.dto.SignupRequest;
import com.studiobs.spring_backend.domain.auth.dto.TokenResponse;
import com.studiobs.spring_backend.domain.auth.service.AuthService;
import com.studiobs.spring_backend.domain.auth.service.AuthService.IssuedTokens;
import com.studiobs.spring_backend.domain.auth.support.RefreshTokenCookieFactory;
import com.studiobs.spring_backend.global.common.MessageResponse;
import com.studiobs.spring_backend.global.config.CookieProperties;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;
    private final RefreshTokenCookieFactory refreshTokenCookieFactory;
    private final CookieProperties cookieProperties;

    @PostMapping("/email/request")
    @ResponseStatus(HttpStatus.OK)
    public MessageResponse requestSignupEmail(@Valid @RequestBody EmailRequest request) {
        authService.requestSignupEmail(request);
        return new MessageResponse("인증 코드를 이메일로 발송했습니다.");
    }

    @PostMapping("/email/verify")
    @ResponseStatus(HttpStatus.OK)
    public MessageResponse verifySignupEmail(@Valid @RequestBody EmailVerifyRequest request) {
        authService.verifySignupEmail(request);
        return new MessageResponse("이메일 인증이 완료되었습니다.");
    }

    @PostMapping("/signup")
    @ResponseStatus(HttpStatus.CREATED)
    public MessageResponse signup(@Valid @RequestBody SignupRequest request) {
        authService.signup(request);
        return new MessageResponse("회원가입이 완료되었습니다.");
    }

    @PostMapping("/login")
    public ResponseEntity<TokenResponse> login(@Valid @RequestBody LoginRequest request) {
        IssuedTokens tokens = authService.login(request);
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE,
                        refreshTokenCookieFactory.create(tokens.refreshToken()).toString())
                .body(new TokenResponse(tokens.accessToken()));
    }

    @PostMapping("/refresh")
    public ResponseEntity<TokenResponse> refresh(HttpServletRequest request) {
        IssuedTokens tokens = authService.refresh(extractRefreshToken(request));
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE,
                        refreshTokenCookieFactory.create(tokens.refreshToken()).toString())
                .body(new TokenResponse(tokens.accessToken()));
    }

    @PostMapping("/logout")
    public ResponseEntity<MessageResponse> logout(HttpServletRequest request) {
        authService.logout(extractRefreshToken(request));
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, refreshTokenCookieFactory.clear().toString())
                .body(new MessageResponse("로그아웃되었습니다."));
    }

    private String extractRefreshToken(HttpServletRequest request) {
        Cookie[] cookies = request.getCookies();
        if (cookies == null) {
            return null;
        }

        for (Cookie cookie : cookies) {
            if (cookieProperties.refreshTokenName().equals(cookie.getName())) {
                return cookie.getValue();
            }
        }
        return null;
    }
}
