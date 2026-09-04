package com.studiobs.spring_backend.domain.brew.ws;

import com.studiobs.spring_backend.domain.brew.dto.VevenoWsEvent;
import com.studiobs.spring_backend.global.exception.BusinessException;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.ObjectMapper;

@Component
@RequiredArgsConstructor
public class VevenoWsPublisher {

    public static final String CHANNEL_PREFIX = "veveno:ws:store:";

    private final StringRedisTemplate stringRedisTemplate;
    private final ObjectMapper objectMapper;

    public void publish(VevenoWsEvent event) {
        if (event.storeId() == null) {
            return;
        }
        try {
            stringRedisTemplate.convertAndSend(
                    CHANNEL_PREFIX + event.storeId(),
                    objectMapper.writeValueAsString(event));
        } catch (JacksonException ex) {
            throw new BusinessException(
                    HttpStatus.INTERNAL_SERVER_ERROR, "VEVENO_WS_PUBLISH", "실시간 알림을 보낼 수 없습니다.");
        }
    }
}
