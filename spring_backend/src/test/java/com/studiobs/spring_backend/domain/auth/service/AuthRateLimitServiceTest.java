package com.studiobs.spring_backend.domain.auth.service;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.studiobs.spring_backend.global.exception.BusinessException;
import java.time.Duration;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.http.HttpStatus;

@ExtendWith(MockitoExtension.class)
class AuthRateLimitServiceTest {

    @Mock
    private StringRedisTemplate stringRedisTemplate;

    @Mock
    private ValueOperations<String, String> valueOperations;

    private AuthRateLimitService service;

    @BeforeEach
    void setUp() {
        when(stringRedisTemplate.opsForValue()).thenReturn(valueOperations);
        service = new AuthRateLimitService(stringRedisTemplate);
    }

    @Test
    void checkEmailSend_throws429_whenCooldownActive() {
        when(valueOperations.setIfAbsent(anyString(), eq("1"), any(Duration.class)))
                .thenReturn(false);

        assertThatThrownBy(() -> service.checkEmailSend("user@example.com", "127.0.0.1"))
                .isInstanceOf(BusinessException.class)
                .satisfies(ex -> {
                    BusinessException be = (BusinessException) ex;
                    org.assertj.core.api.Assertions.assertThat(be.getStatus())
                            .isEqualTo(HttpStatus.TOO_MANY_REQUESTS);
                    org.assertj.core.api.Assertions.assertThat(be.getMessage())
                            .contains("1분");
                });

        verify(valueOperations, never()).increment(anyString());
    }

    @Test
    void checkEmailSend_throws429_whenWindowExceeded() {
        when(valueOperations.setIfAbsent(anyString(), eq("1"), any(Duration.class)))
                .thenReturn(true);
        when(valueOperations.increment(anyString())).thenReturn(6L);

        assertThatThrownBy(() -> service.checkEmailSend("user@example.com", "127.0.0.1"))
                .isInstanceOf(BusinessException.class)
                .satisfies(ex -> {
                    BusinessException be = (BusinessException) ex;
                    org.assertj.core.api.Assertions.assertThat(be.getStatus())
                            .isEqualTo(HttpStatus.TOO_MANY_REQUESTS);
                    org.assertj.core.api.Assertions.assertThat(be.getMessage())
                            .contains("너무 많습니다");
                });
    }

    @Test
    void checkLogin_throws429_whenWindowExceeded() {
        when(valueOperations.increment(anyString())).thenReturn(11L);

        assertThatThrownBy(() -> service.checkLogin("user@example.com", "10.0.0.1"))
                .isInstanceOf(BusinessException.class)
                .satisfies(ex -> {
                    BusinessException be = (BusinessException) ex;
                    org.assertj.core.api.Assertions.assertThat(be.getStatus())
                            .isEqualTo(HttpStatus.TOO_MANY_REQUESTS);
                });
    }

    @Test
    void checkEmailVerify_allowsWithinLimit() {
        when(valueOperations.increment(anyString())).thenReturn(1L);

        service.checkEmailVerify("user@example.com", "127.0.0.1");

        verify(stringRedisTemplate, org.mockito.Mockito.atLeastOnce())
                .expire(anyString(), any(Duration.class));
    }
}
