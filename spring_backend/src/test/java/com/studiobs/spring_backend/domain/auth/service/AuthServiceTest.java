package com.studiobs.spring_backend.domain.auth.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.studiobs.spring_backend.domain.auth.dto.DeleteAccountRequest;
import com.studiobs.spring_backend.domain.auth.dto.LoginRequest;
import com.studiobs.spring_backend.domain.auth.jwt.JwtTokenProvider;
import com.studiobs.spring_backend.domain.mail.service.MailService;
import com.studiobs.spring_backend.domain.user.entity.User;
import com.studiobs.spring_backend.domain.user.service.UserService;
import com.studiobs.spring_backend.global.exception.BusinessException;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    @Mock
    private UserService userService;
    @Mock
    private AuthRedisService authRedisService;
    @Mock
    private AuthRateLimitService authRateLimitService;
    @Mock
    private MailService mailService;
    @Mock
    private JwtTokenProvider jwtTokenProvider;

    @InjectMocks
    private AuthService authService;

    @Test
    void login_throwsUnauthorized_whenPasswordMismatch() {
        User user = userWithEmail("user@example.com");
        when(userService.findByEmail("user@example.com")).thenReturn(Optional.of(user));
        when(userService.matchesPassword(user, "wrong")).thenReturn(false);

        assertThatThrownBy(() -> authService.login(
                        new LoginRequest("user@example.com", "wrong"), "127.0.0.1"))
                .isInstanceOf(BusinessException.class)
                .satisfies(ex -> assertThat(((BusinessException) ex).getStatus())
                        .isEqualTo(HttpStatus.UNAUTHORIZED));

        verify(jwtTokenProvider, never()).createAccessToken(user);
    }

    @Test
    void login_throwsUnauthorized_whenUserMissing() {
        when(userService.findByEmail("missing@example.com")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> authService.login(
                        new LoginRequest("missing@example.com", "pw"), "127.0.0.1"))
                .isInstanceOf(BusinessException.class)
                .satisfies(ex -> assertThat(((BusinessException) ex).getStatus())
                        .isEqualTo(HttpStatus.UNAUTHORIZED));
    }

    @Test
    void changePassword_rejectsSamePassword() {
        User user = userWithEmail("user@example.com");
        when(authRedisService.isPasswordChangeVerified("user@example.com")).thenReturn(true);
        when(userService.findByEmail("user@example.com")).thenReturn(Optional.of(user));
        when(userService.matchesPassword(user, "same-pw")).thenReturn(true);

        assertThatThrownBy(() -> authService.changePassword("user@example.com", "same-pw"))
                .isInstanceOf(BusinessException.class)
                .satisfies(ex -> {
                    BusinessException be = (BusinessException) ex;
                    assertThat(be.getStatus()).isEqualTo(HttpStatus.BAD_REQUEST);
                    assertThat(be.getMessage()).contains("다른 비밀번호");
                });

        verify(userService, never()).updatePassword(user, "same-pw");
    }

    @Test
    void refresh_throwsUnauthorized_whenTokenInvalid() {
        when(jwtTokenProvider.isValid("bad")).thenReturn(false);

        assertThatThrownBy(() -> authService.refresh("bad"))
                .isInstanceOf(BusinessException.class)
                .satisfies(ex -> assertThat(((BusinessException) ex).getStatus())
                        .isEqualTo(HttpStatus.UNAUTHORIZED));
    }

    @Test
    void refresh_throwsUnauthorized_whenRedisMismatch() {
        when(jwtTokenProvider.isValid("rt")).thenReturn(true);
        when(jwtTokenProvider.isRefreshToken("rt")).thenReturn(true);
        when(jwtTokenProvider.getEmail("rt")).thenReturn("user@example.com");
        when(authRedisService.matchesRefreshToken("user@example.com", "rt")).thenReturn(false);

        assertThatThrownBy(() -> authService.refresh("rt"))
                .isInstanceOf(BusinessException.class)
                .satisfies(ex -> assertThat(((BusinessException) ex).getStatus())
                        .isEqualTo(HttpStatus.UNAUTHORIZED));
    }

    @Test
    void logout_deletesRefreshToken_whenValid() {
        when(jwtTokenProvider.isValid("rt")).thenReturn(true);
        when(jwtTokenProvider.isRefreshToken("rt")).thenReturn(true);
        when(jwtTokenProvider.getEmail("rt")).thenReturn("user@example.com");

        authService.logout("rt");

        verify(authRedisService).deleteRefreshToken("user@example.com");
    }

    @Test
    void deleteAccount_deletesRefreshTokenAndUser() {
        User user = userWithEmail("user@example.com");
        when(userService.findByEmail("user@example.com")).thenReturn(Optional.of(user));
        when(userService.matchesPassword(user, "pw")).thenReturn(true);
        when(jwtTokenProvider.isValid("rt")).thenReturn(true);
        when(jwtTokenProvider.isRefreshToken("rt")).thenReturn(true);
        when(jwtTokenProvider.getEmail("rt")).thenReturn("user@example.com");

        authService.deleteAccount("user@example.com", new DeleteAccountRequest("pw"), "rt");

        verify(authRedisService, atLeastOnce()).deleteRefreshToken("user@example.com");
        verify(userService).delete(user);
    }

    private static User userWithEmail(String email) {
        User user = User.builder()
                .email(email)
                .password("hash")
                .nickname("nick")
                .userClass(com.studiobs.spring_backend.domain.user.entity.UserClass.FREE)
                .build();
        ReflectionTestUtils.setField(user, "id", UUID.randomUUID());
        return user;
    }
}
