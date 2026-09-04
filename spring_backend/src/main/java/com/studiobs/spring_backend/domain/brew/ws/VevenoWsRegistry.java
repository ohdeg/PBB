package com.studiobs.spring_backend.domain.brew.ws;

import com.studiobs.spring_backend.domain.brew.dto.VevenoWsEvent;
import java.io.IOException;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArraySet;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.ObjectMapper;

@Component
public class VevenoWsRegistry {

    public record Bind(
            WebSocketSession session,
            Set<UUID> stockCheckStores,
            Set<UUID> noticeStores
    ) {
    }

    private final ConcurrentHashMap<String, Bind> bySession = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<UUID, CopyOnWriteArraySet<String>> byStore = new ConcurrentHashMap<>();
    private final ObjectMapper objectMapper;

    public VevenoWsRegistry(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public void register(Bind bind) {
        String id = bind.session().getId();
        Bind previous = bySession.put(id, bind);
        if (previous != null) {
            dropIndex(id, previous);
        }
        for (UUID storeId : union(bind.stockCheckStores(), bind.noticeStores())) {
            byStore.computeIfAbsent(storeId, ignored -> new CopyOnWriteArraySet<>()).add(id);
        }
    }

    public void remove(String sessionId) {
        Bind bind = bySession.remove(sessionId);
        if (bind != null) {
            dropIndex(sessionId, bind);
        }
    }

    public void fanout(String json) {
        VevenoWsEvent event;
        try {
            event = objectMapper.readValue(json, VevenoWsEvent.class);
        } catch (JacksonException ex) {
            return;
        }
        if (event.storeId() == null) {
            return;
        }
        CopyOnWriteArraySet<String> ids = byStore.get(event.storeId());
        if (ids == null) {
            return;
        }
        for (String sessionId : ids) {
            Bind bind = bySession.get(sessionId);
            if (bind == null || !allows(bind, event)) {
                continue;
            }
            send(bind.session(), json);
        }
    }

    public void send(WebSocketSession session, String json) {
        if (!session.isOpen()) {
            return;
        }
        synchronized (session) {
            try {
                session.sendMessage(new TextMessage(json));
            } catch (IOException ignored) {
                /* closed between isOpen and send */
            }
        }
    }

    private void dropIndex(String sessionId, Bind bind) {
        for (UUID storeId : union(bind.stockCheckStores(), bind.noticeStores())) {
            CopyOnWriteArraySet<String> ids = byStore.get(storeId);
            if (ids == null) {
                continue;
            }
            ids.remove(sessionId);
            if (ids.isEmpty()) {
                byStore.remove(storeId, ids);
            }
        }
    }

    private static boolean allows(Bind bind, VevenoWsEvent event) {
        UUID storeId = event.storeId();
        if ("stockCheck".equals(event.topic())) {
            return bind.stockCheckStores().contains(storeId);
        }
        if ("notice".equals(event.topic())) {
            return bind.noticeStores().contains(storeId);
        }
        return false;
    }

    private static Set<UUID> union(Set<UUID> left, Set<UUID> right) {
        Set<UUID> all = ConcurrentHashMap.newKeySet();
        all.addAll(left);
        all.addAll(right);
        return all;
    }
}
