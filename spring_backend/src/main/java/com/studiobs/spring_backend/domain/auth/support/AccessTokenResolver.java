package com.studiobs.spring_backend.domain.auth.support;

import com.studiobs.spring_backend.domain.auth.jwt.JwtTokenProvider;
import com.studiobs.spring_backend.global.exception.BusinessException;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class AccessTokenResolver {

    private final JwtTokenProvider jwtTokenProvider;

    public String requireEmail(HttpServletRequest request) {
        String header = request.getHeader(HttpHeaders.AUTHORIZATION);
        if (header == null || !header.startsWith("Bearer ")) {
            throw new BusinessException(HttpStatus.UNAUTHORIZED, "로그인이 필요합니다.");
        }

        String token = header.substring("Bearer ".length()).trim();
        if (token.isEmpty()
                || !jwtTokenProvider.isValid(token)
                || !jwtTokenProvider.isAccessToken(token)) {
            throw new BusinessException(HttpStatus.UNAUTHORIZED, "유효하지 않은 Access Token입니다.");
        }

        return jwtTokenProvider.getEmail(token);
    }
}
