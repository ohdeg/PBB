package com.studiobs.spring_backend.global.config;

import com.studiobs.spring_backend.domain.brew.ws.VevenoWsHandler;
import com.studiobs.spring_backend.domain.brew.ws.VevenoWsPublisher;
import com.studiobs.spring_backend.domain.brew.ws.VevenoWsRegistry;
import java.util.Arrays;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.connection.MessageListener;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.listener.PatternTopic;
import org.springframework.data.redis.listener.RedisMessageListenerContainer;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

@Configuration
@EnableWebSocket
public class VevenoWsConfig implements WebSocketConfigurer {

    private final VevenoWsHandler vevenoWsHandler;
    private final List<String> allowedOrigins;

    public VevenoWsConfig(
            VevenoWsHandler vevenoWsHandler,
            @Value("${app.cors.allowed-origins}") String allowedOrigins
    ) {
        this.vevenoWsHandler = vevenoWsHandler;
        this.allowedOrigins = Arrays.stream(allowedOrigins.split(","))
                .map(String::trim)
                .filter(origin -> !origin.isEmpty())
                .toList();
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(vevenoWsHandler, "/api/v1/veveno/ws", "/api/v1/brew/ws")
                .setAllowedOrigins(allowedOrigins.toArray(String[]::new));
    }

    @Bean
    RedisMessageListenerContainer vevenoWsRedisContainer(
            RedisConnectionFactory connectionFactory,
            VevenoWsRegistry registry
    ) {
        RedisMessageListenerContainer container = new RedisMessageListenerContainer();
        container.setConnectionFactory(connectionFactory);
        MessageListener listener = (message, pattern) ->
                registry.fanout(new String(message.getBody(), java.nio.charset.StandardCharsets.UTF_8));
        container.addMessageListener(listener, new PatternTopic(VevenoWsPublisher.CHANNEL_PREFIX + "*"));
        return container;
    }
}
