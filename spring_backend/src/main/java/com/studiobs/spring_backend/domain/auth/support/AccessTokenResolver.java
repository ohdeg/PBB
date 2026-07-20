package com.studiobs.spring_backend.domain.auth.support;

import com.studiobs.spring_backend.domain.auth.jwt.JwtTokenProvider;
import com.studiobs.spring_backend.global.exception.BusinessException;
import jakarta.servlet.http.HttpServletRequest;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class AccessTokenResolver {

    private final JwtTokenProvider jwtTokenProvider;

    public String requireEmail(HttpServletRequest request) {
        return findEmail(request)
                .orElseThrow(() -> new BusinessException(HttpStatus.UNAUTHORIZED, "로그인이 필요합니다."));
    }

    public Optional<String> findEmail(HttpServletRequest request) {
        String header = request.getHeader(HttpHeaders.AUTHORIZATION);
        if (header == null || !header.startsWith("Bearer ")) {
            return Optional.empty();
        }

        String token = header.substring("Bearer ".length()).trim();
        if (token.isEmpty()
                || !jwtTokenProvider.isValid(token)
                || !jwtTokenProvider.isAccessToken(token)) {
            return Optional.empty();
        }

        return Optional.of(jwtTokenProvider.getEmail(token));
    }
}
