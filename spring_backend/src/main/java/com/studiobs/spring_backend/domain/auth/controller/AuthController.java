package com.studiobs.spring_backend.domain.auth.controller;

import com.studiobs.spring_backend.domain.auth.dto.DeleteAccountRequest;
import com.studiobs.spring_backend.domain.auth.dto.EmailRequest;
import com.studiobs.spring_backend.domain.auth.dto.EmailVerifyRequest;
import com.studiobs.spring_backend.domain.auth.dto.LoginRequest;
import com.studiobs.spring_backend.domain.auth.dto.PasswordChangeRequest;
import com.studiobs.spring_backend.domain.auth.dto.PasswordChangeVerifyRequest;
import com.studiobs.spring_backend.domain.auth.dto.PasswordResetRequest;
import com.studiobs.spring_backend.domain.auth.dto.SignupRequest;
import com.studiobs.spring_backend.domain.auth.dto.TokenResponse;
import com.studiobs.spring_backend.domain.auth.service.AuthService;
import com.studiobs.spring_backend.domain.auth.service.AuthService.IssuedTokens;
import com.studiobs.spring_backend.domain.auth.support.AccessTokenResolver;
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
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PatchMapping;
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
    private final AccessTokenResolver accessTokenResolver;

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

    @DeleteMapping("/account")
    public ResponseEntity<MessageResponse> deleteAccount(
            HttpServletRequest request,
            @Valid @RequestBody DeleteAccountRequest body
    ) {
        String email = accessTokenResolver.requireEmail(request);
        authService.deleteAccount(email, body, extractRefreshToken(request));
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, refreshTokenCookieFactory.clear().toString())
                .body(new MessageResponse("회원 탈퇴가 완료되었습니다."));
    }

    @PostMapping("/password/request")
    @ResponseStatus(HttpStatus.OK)
    public MessageResponse requestPasswordReset(@Valid @RequestBody EmailRequest request) {
        authService.requestPasswordReset(request);
        return new MessageResponse("인증 코드를 이메일로 발송했습니다.");
    }

    @PostMapping("/password/verify")
    @ResponseStatus(HttpStatus.OK)
    public MessageResponse verifyPasswordReset(@Valid @RequestBody EmailVerifyRequest request) {
        authService.verifyPasswordReset(request);
        return new MessageResponse("이메일 인증이 완료되었습니다.");
    }

    @PatchMapping("/password/reset")
    @ResponseStatus(HttpStatus.OK)
    public MessageResponse resetPassword(@Valid @RequestBody PasswordResetRequest request) {
        authService.resetPassword(request);
        return new MessageResponse("비밀번호가 변경되었습니다. 다시 로그인해 주세요.");
    }

    @PostMapping("/password/change/request")
    @ResponseStatus(HttpStatus.OK)
    public MessageResponse requestPasswordChange(HttpServletRequest request) {
        String email = accessTokenResolver.requireEmail(request);
        authService.requestPasswordChange(email);
        return new MessageResponse("인증 코드를 이메일로 발송했습니다.");
    }

    @PostMapping("/password/change/verify")
    @ResponseStatus(HttpStatus.OK)
    public MessageResponse verifyPasswordChange(
            HttpServletRequest request,
            @Valid @RequestBody PasswordChangeVerifyRequest body
    ) {
        String email = accessTokenResolver.requireEmail(request);
        authService.verifyPasswordChange(email, body.code());
        return new MessageResponse("이메일 인증이 완료되었습니다.");
    }

    @PatchMapping("/password/change")
    public ResponseEntity<MessageResponse> changePassword(
            HttpServletRequest request,
            @Valid @RequestBody PasswordChangeRequest body
    ) {
        String email = accessTokenResolver.requireEmail(request);
        authService.changePassword(email, body.newPassword());
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, refreshTokenCookieFactory.clear().toString())
                .body(new MessageResponse("비밀번호가 변경되었습니다. 다시 로그인해 주세요."));
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
