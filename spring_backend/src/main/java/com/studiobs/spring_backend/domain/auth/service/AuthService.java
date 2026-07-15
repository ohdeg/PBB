package com.studiobs.spring_backend.domain.auth.service;

import com.studiobs.spring_backend.domain.auth.consent.ConsentCatalog;
import com.studiobs.spring_backend.domain.auth.dto.ConsentAgreementRequest;
import com.studiobs.spring_backend.domain.auth.dto.EmailRequest;
import com.studiobs.spring_backend.domain.auth.dto.EmailVerifyRequest;
import com.studiobs.spring_backend.domain.auth.dto.LoginRequest;
import com.studiobs.spring_backend.domain.auth.dto.PasswordResetRequest;
import com.studiobs.spring_backend.domain.auth.dto.SignupRequest;
import com.studiobs.spring_backend.domain.auth.jwt.JwtTokenProvider;
import com.studiobs.spring_backend.domain.mail.service.MailService;
import com.studiobs.spring_backend.domain.user.entity.User;
import com.studiobs.spring_backend.domain.user.service.UserService;
import com.studiobs.spring_backend.global.exception.BusinessException;
import java.security.SecureRandom;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AuthService {

    private static final String INVALID_CREDENTIALS_MESSAGE =
            "이메일 혹은 비밀번호가 일치하지 않습니다.";

    private final UserService userService;
    private final AuthRedisService authRedisService;
    private final MailService mailService;
    private final JwtTokenProvider jwtTokenProvider;
    private final SecureRandom secureRandom = new SecureRandom();

    public void requestSignupEmail(EmailRequest request) {
        String email = normalizeEmail(request.email());

        if (userService.existsByEmail(email)) {
            throw new BusinessException(HttpStatus.CONFLICT, "이미 가입된 이메일입니다.");
        }

        String code = generateSixDigitCode();
        authRedisService.saveSignupCode(email, code);
        mailService.sendVerificationCode(email, code);
    }

    public void verifySignupEmail(EmailVerifyRequest request) {
        String email = normalizeEmail(request.email());
        String code = request.code().trim();

        String savedCode = authRedisService.getSignupCode(email)
                .orElseThrow(() -> new BusinessException(
                        HttpStatus.BAD_REQUEST,
                        "인증 코드가 만료되었거나 요청되지 않았습니다."));

        if (!savedCode.equals(code)) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "인증 코드가 올바르지 않습니다.");
        }

        authRedisService.deleteSignupCode(email);
        authRedisService.markSignupVerified(email);
    }

    @Transactional
    public void signup(SignupRequest request) {
        String email = normalizeEmail(request.email());
        String nickname = request.nickname().trim();

        if (!authRedisService.isSignupVerified(email)) {
            throw new BusinessException(
                    HttpStatus.BAD_REQUEST,
                    "이메일 인증을 먼저 완료해 주세요.");
        }

        if (userService.existsByEmail(email)) {
            throw new BusinessException(HttpStatus.CONFLICT, "이미 가입된 이메일입니다.");
        }

        if (userService.existsByNickname(nickname)) {
            throw new BusinessException(HttpStatus.CONFLICT, "이미 사용 중인 닉네임입니다.");
        }

        List<UserService.ConsentInput> consentInputs = validateAndNormalizeConsents(request.consents());

        userService.register(email, nickname, request.password(), consentInputs);
        authRedisService.deleteSignupVerified(email);
    }

    private List<UserService.ConsentInput> validateAndNormalizeConsents(
            List<ConsentAgreementRequest> submitted
    ) {
        Map<String, ConsentAgreementRequest> byKey = new HashMap<>();
        for (ConsentAgreementRequest item : submitted) {
            if (item.key() == null || item.key().isBlank()) {
                throw new BusinessException(HttpStatus.BAD_REQUEST, "동의 항목 키가 올바르지 않습니다.");
            }
            byKey.put(item.key().trim(), item);
        }

        for (ConsentCatalog required : ConsentCatalog.requiredActiveItems()) {
            ConsentAgreementRequest agreement = byKey.get(required.key());
            if (agreement == null || !Boolean.TRUE.equals(agreement.agreed())) {
                throw new BusinessException(
                        HttpStatus.BAD_REQUEST,
                        "필수 동의 항목에 모두 동의해 주세요.");
            }
        }

        return ConsentCatalog.activeItems().stream()
                .map(catalogItem -> {
                    ConsentAgreementRequest agreement = byKey.get(catalogItem.key());
                    boolean agreed = agreement != null && Boolean.TRUE.equals(agreement.agreed());
                    String version = agreement != null && agreement.version() != null
                            && !agreement.version().isBlank()
                            ? agreement.version().trim()
                            : catalogItem.version();
                    return new UserService.ConsentInput(catalogItem.key(), agreed, version);
                })
                .toList();
    }

    @Transactional(readOnly = true)
    public IssuedTokens login(LoginRequest request) {
        String email = normalizeEmail(request.email());

        User user = userService.findByEmail(email)
                .orElseThrow(() -> new BusinessException(
                        HttpStatus.UNAUTHORIZED,
                        INVALID_CREDENTIALS_MESSAGE));

        if (!userService.matchesPassword(user, request.password())) {
            throw new BusinessException(HttpStatus.UNAUTHORIZED, INVALID_CREDENTIALS_MESSAGE);
        }

        String accessToken = jwtTokenProvider.createAccessToken(user);
        String refreshToken = jwtTokenProvider.createRefreshToken(user);
        authRedisService.saveRefreshToken(email, refreshToken);

        return new IssuedTokens(accessToken, refreshToken);
    }

    @Transactional(readOnly = true)
    public IssuedTokens refresh(String refreshToken) {
        if (refreshToken == null || refreshToken.isBlank()
                || !jwtTokenProvider.isValid(refreshToken)
                || !jwtTokenProvider.isRefreshToken(refreshToken)) {
            throw new BusinessException(HttpStatus.UNAUTHORIZED, "유효하지 않은 Refresh Token입니다.");
        }

        String email = jwtTokenProvider.getEmail(refreshToken);
        if (!authRedisService.matchesRefreshToken(email, refreshToken)) {
            throw new BusinessException(HttpStatus.UNAUTHORIZED, "유효하지 않은 Refresh Token입니다.");
        }

        User user = userService.findByEmail(email)
                .orElseThrow(() -> new BusinessException(
                        HttpStatus.UNAUTHORIZED,
                        "유효하지 않은 Refresh Token입니다."));

        String newAccessToken = jwtTokenProvider.createAccessToken(user);
        String newRefreshToken = jwtTokenProvider.createRefreshToken(user);
        authRedisService.saveRefreshToken(email, newRefreshToken);

        return new IssuedTokens(newAccessToken, newRefreshToken);
    }

    public void logout(String refreshToken) {
        if (refreshToken == null || refreshToken.isBlank()) {
            return;
        }

        if (jwtTokenProvider.isValid(refreshToken) && jwtTokenProvider.isRefreshToken(refreshToken)) {
            String email = jwtTokenProvider.getEmail(refreshToken);
            authRedisService.deleteRefreshToken(email);
        }
    }

    public void requestPasswordChange(String email) {
        String normalized = normalizeEmail(email);
        if (userService.findByEmail(normalized).isEmpty()) {
            throw new BusinessException(HttpStatus.UNAUTHORIZED, "로그인이 필요합니다.");
        }

        String code = generateSixDigitCode();
        authRedisService.savePasswordChangeCode(normalized, code);
        authRedisService.deletePasswordChangeVerified(normalized);
        mailService.sendVerificationCode(normalized, code);
    }

    public void verifyPasswordChange(String email, String code) {
        String normalized = normalizeEmail(email);
        String trimmedCode = code.trim();

        String savedCode = authRedisService.getPasswordChangeCode(normalized)
                .orElseThrow(() -> new BusinessException(
                        HttpStatus.BAD_REQUEST,
                        "인증 코드가 만료되었거나 요청되지 않았습니다."));

        if (!savedCode.equals(trimmedCode)) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "인증 코드가 올바르지 않습니다.");
        }

        authRedisService.deletePasswordChangeCode(normalized);
        authRedisService.markPasswordChangeVerified(normalized);
    }

    @Transactional
    public void changePassword(String email, String newPassword) {
        String normalized = normalizeEmail(email);

        if (!authRedisService.isPasswordChangeVerified(normalized)) {
            throw new BusinessException(
                    HttpStatus.BAD_REQUEST,
                    "이메일 인증을 먼저 완료해 주세요.");
        }

        User user = userService.findByEmail(normalized)
                .orElseThrow(() -> new BusinessException(
                        HttpStatus.UNAUTHORIZED,
                        "로그인이 필요합니다."));

        if (userService.matchesPassword(user, newPassword)) {
            throw new BusinessException(
                    HttpStatus.BAD_REQUEST,
                    "현재와 다른 비밀번호를 입력해 주세요.");
        }

        userService.updatePassword(user, newPassword);
        authRedisService.deletePasswordChangeVerified(normalized);
        authRedisService.deletePasswordChangeCode(normalized);
        authRedisService.deleteRefreshToken(normalized);
    }

    public void requestPasswordReset(EmailRequest request) {
        String email = normalizeEmail(request.email());

        if (userService.findByEmail(email).isEmpty()) {
            throw new BusinessException(HttpStatus.NOT_FOUND, "가입된 이메일이 아닙니다.");
        }

        String code = generateSixDigitCode();
        authRedisService.savePasswordResetCode(email, code);
        authRedisService.deletePasswordResetVerified(email);
        mailService.sendVerificationCode(email, code);
    }

    public void verifyPasswordReset(EmailVerifyRequest request) {
        String email = normalizeEmail(request.email());
        String code = request.code().trim();

        String savedCode = authRedisService.getPasswordResetCode(email)
                .orElseThrow(() -> new BusinessException(
                        HttpStatus.BAD_REQUEST,
                        "인증 코드가 만료되었거나 요청되지 않았습니다."));

        if (!savedCode.equals(code)) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "인증 코드가 올바르지 않습니다.");
        }

        authRedisService.deletePasswordResetCode(email);
        authRedisService.markPasswordResetVerified(email);
    }

    @Transactional
    public void resetPassword(PasswordResetRequest request) {
        String email = normalizeEmail(request.email());

        if (!authRedisService.isPasswordResetVerified(email)) {
            throw new BusinessException(
                    HttpStatus.BAD_REQUEST,
                    "이메일 인증을 먼저 완료해 주세요.");
        }

        User user = userService.findByEmail(email)
                .orElseThrow(() -> new BusinessException(
                        HttpStatus.NOT_FOUND,
                        "가입된 이메일이 아닙니다."));

        if (userService.matchesPassword(user, request.newPassword())) {
            throw new BusinessException(
                    HttpStatus.BAD_REQUEST,
                    "현재와 다른 비밀번호를 입력해 주세요.");
        }

        userService.updatePassword(user, request.newPassword());
        authRedisService.deletePasswordResetVerified(email);
        authRedisService.deletePasswordResetCode(email);
        authRedisService.deleteRefreshToken(email);
    }

    private String generateSixDigitCode() {
        return String.format("%06d", secureRandom.nextInt(1_000_000));
    }

    private String normalizeEmail(String email) {
        return email.trim().toLowerCase();
    }

    public record IssuedTokens(String accessToken, String refreshToken) {
    }
}
