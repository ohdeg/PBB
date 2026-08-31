package com.studiobs.spring_backend.global.security;

import com.studiobs.spring_backend.domain.auth.jwt.JwtTokenProvider;
import com.studiobs.spring_backend.domain.brew.support.PosAccess;
import com.studiobs.spring_backend.domain.brew.support.VevenoPosGuard;
import com.studiobs.spring_backend.domain.user.entity.UserClass;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
@RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private static final String BEARER_PREFIX = "Bearer ";

    private final JwtTokenProvider jwtTokenProvider;
    private final VevenoPosGuard vevenoPosGuard;

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {
        try {
            String token = resolveBearerToken(request);
            if (token != null && SecurityContextHolder.getContext().getAuthentication() == null) {
                authenticate(request, token);
            }
            filterChain.doFilter(request, response);
        } finally {
            PosAccess.clear();
        }
    }

    private void authenticate(HttpServletRequest request, String token) {
        if (!jwtTokenProvider.isValid(token)) {
            return;
        }
        if (jwtTokenProvider.isAccessToken(token)) {
            setAuthentication(token);
            return;
        }
        if (jwtTokenProvider.isPosToken(token)
                && isBrewPath(request)
                && vevenoPosGuard.bind(token)) {
            setAuthentication(token);
        }
    }

    private void setAuthentication(String token) {
        String email = jwtTokenProvider.getEmail(token);
        UserClass userClass = jwtTokenProvider.getUserClass(token);
        var authority = new SimpleGrantedAuthority("ROLE_" + userClass.name());
        var authentication = new UsernamePasswordAuthenticationToken(
                email,
                token,
                List.of(authority)
        );
        SecurityContextHolder.getContext().setAuthentication(authentication);
    }

    private static boolean isBrewPath(HttpServletRequest request) {
        String path = request.getRequestURI();
        return path.startsWith("/api/v1/veveno") || path.startsWith("/api/v1/brew");
    }

    private static String resolveBearerToken(HttpServletRequest request) {
        String authorization = request.getHeader(HttpHeaders.AUTHORIZATION);
        if (authorization == null || !authorization.startsWith(BEARER_PREFIX)) {
            return null;
        }
        String token = authorization.substring(BEARER_PREFIX.length()).trim();
        return token.isEmpty() ? null : token;
    }
}
