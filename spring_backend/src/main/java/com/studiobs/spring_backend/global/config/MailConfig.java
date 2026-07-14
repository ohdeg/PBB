package com.studiobs.spring_backend.global.config;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Configuration;

/**
 * 메일 인프라 설정 마커.
 * 실제 SMTP 연결 정보는 application-*.yaml의 spring.mail.* 를 사용합니다.
 * Mock 모드(app.mail.mock=true)에서는 JavaMailSender 빈이 없어도 동작합니다.
 */
@Configuration
@ConditionalOnProperty(name = "app.mail.mock", havingValue = "false", matchIfMissing = true)
public class MailConfig {
}
