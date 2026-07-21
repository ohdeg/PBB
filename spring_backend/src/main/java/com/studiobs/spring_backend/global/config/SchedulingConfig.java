package com.studiobs.spring_backend.global.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

/** @Scheduled 작업(예: 6PICK 당첨번호 자동 동기화) 활성화. */
@Configuration
@EnableScheduling
public class SchedulingConfig {
}
