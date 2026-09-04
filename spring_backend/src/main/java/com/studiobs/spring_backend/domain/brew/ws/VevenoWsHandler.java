package com.studiobs.spring_backend.domain.brew.ws;

import com.studiobs.spring_backend.domain.auth.jwt.JwtTokenProvider;
import com.studiobs.spring_backend.domain.brew.dto.VevenoWsAuth;
import com.studiobs.spring_backend.domain.brew.dto.VevenoWsEvent;
import com.studiobs.spring_backend.domain.brew.support.PosAccess;
import com.studiobs.spring_backend.domain.brew.support.VevenoPosGuard;
import java.io.IOException;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.ObjectMapper;

@Component
@RequiredArgsConstructor
public class VevenoWsHandler extends TextWebSocketHandler {

    private static final String ATTR_BOUND = "vevenoWsBound";
    private static final CloseStatus AUTH_REQUIRED =
            CloseStatus.POLICY_VIOLATION.withReason("auth required");

    private final JwtTokenProvider jwtTokenProvider;
    private final VevenoPosGuard vevenoPosGuard;
    private final VevenoWsSnapshotService snapshotService;
    private final VevenoWsRegistry registry;
    private final ObjectMapper objectMapper;
    private final ScheduledExecutorService authTimeouts = Executors.newSingleThreadScheduledExecutor(thread -> {
        Thread next = new Thread(thread, "veveno-ws-auth");
        next.setDaemon(true);
        return next;
    });

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        authTimeouts.schedule(() -> {
            if (session.isOpen() && session.getAttributes().get(ATTR_BOUND) == null) {
                try {
                    session.close(AUTH_REQUIRED);
                } catch (IOException ignored) {
                    /* already closing */
                }
            }
        }, 5, TimeUnit.SECONDS);
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) {
        if (Boolean.TRUE.equals(session.getAttributes().get(ATTR_BOUND))) {
            return;
        }
        VevenoWsAuth auth;
        try {
            auth = objectMapper.readValue(message.getPayload(), VevenoWsAuth.class);
        } catch (JacksonException ex) {
            closeQuietly(session, AUTH_REQUIRED);
            return;
        }
        if (auth == null || auth.token() == null || auth.token().isBlank()) {
            closeQuietly(session, AUTH_REQUIRED);
            return;
        }
        String token = auth.token().trim();
        if (!jwtTokenProvider.isValid(token)) {
            closeQuietly(session, AUTH_REQUIRED);
            return;
        }
        try {
            VevenoWsSnapshotService.Result result;
            if (jwtTokenProvider.isPosToken(token)) {
                if (!vevenoPosGuard.bind(token)) {
                    closeQuietly(session, AUTH_REQUIRED);
                    return;
                }
                result = snapshotService.snapshot(jwtTokenProvider.getEmail(token));
            } else if (jwtTokenProvider.isAccessToken(token)) {
                result = snapshotService.snapshot(jwtTokenProvider.getEmail(token));
            } else {
                closeQuietly(session, AUTH_REQUIRED);
                return;
            }
            session.getAttributes().put(ATTR_BOUND, true);
            registry.register(new VevenoWsRegistry.Bind(
                    session,
                    result.scope().stockCheckStores(),
                    result.scope().noticeStores()));
            registry.send(session, objectMapper.writeValueAsString(VevenoWsEvent.hello(result.stores())));
        } catch (RuntimeException ex) {
            closeQuietly(session, AUTH_REQUIRED);
        } finally {
            PosAccess.clear();
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        registry.remove(session.getId());
    }

    private static void closeQuietly(WebSocketSession session, CloseStatus status) {
        try {
            session.close(status);
        } catch (IOException ignored) {
            /* already closing */
        }
    }
}
