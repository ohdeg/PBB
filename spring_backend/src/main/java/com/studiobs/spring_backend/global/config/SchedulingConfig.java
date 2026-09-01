package com.studiobs.spring_backend.global.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

/** @Scheduled 작업(6PICK 동기화, Veveno 퇴사 확정 등) 활성화. */
@Configuration
@EnableScheduling
public class SchedulingConfig {
}
