package com.studiobs.spring_backend.domain.dev.operations;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.time.Instant;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.method.HandlerMethod;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.servlet.HandlerMapping;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
@RequiredArgsConstructor
@Slf4j
public class OperationsWebConfig implements WebMvcConfigurer, HandlerInterceptor {
    private final OperationsLog events;

    @Override public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(this).addPathPatterns("/api/v1/**");
    }

    static String app(String pattern) {
        String[] parts = pattern.split("/");
        return switch (parts.length > 3 ? parts[3] : "") {
            case "veveno", "brew" -> "Veveno";
            case "tempori" -> "Tempori";
            case "sranko" -> "Sranko";
            case "lotto" -> "6pick";
            case "dieta" -> "Dieta";
            default -> "PBB";
        };
    }

    private static final String REF = OperationsWebConfig.class.getName() + ".requestId";

    @Override public boolean preHandle(HttpServletRequest req, HttpServletResponse res, Object handler) {
        if (req.getAttribute(REF) == null) {
            String ref = java.util.UUID.randomUUID().toString();
            req.setAttribute(REF, ref);
            res.setHeader("X-Request-Id", ref);
        }
        return true;
    }

    @Override public void afterCompletion(HttpServletRequest req, HttpServletResponse res, Object handler, Exception ex) {
        if (!(handler instanceof HandlerMethod method) || res.getStatus() < 500 || res.getStatus() > 599) return;
        var pattern = req.getAttribute(HandlerMapping.BEST_MATCHING_PATTERN_ATTRIBUTE);
        String app = app(String.valueOf(pattern));
        String operation = method.getMethod().getName();
        String ref = (String) req.getAttribute(REF);
        log.warn("operation_failure app={} operation={} status={} request_id={}", app, operation, res.getStatus(), ref);
        try {
            events.error(app, operation, res.getStatus(), Instant.now(), ref);
        } catch (RuntimeException unavailable) {
            // Diagnostics must not replace the response, even when the DB itself is unavailable.
            log.warn("Could not persist PBB operation error count");
        }
    }
}
