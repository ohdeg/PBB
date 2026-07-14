package com.studiobs.spring_backend;

import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest
@Disabled("로컬 MySQL/Redis(docker compose) 기동 후 수동으로 컨텍스트 로드를 검증하세요.")
class SpringBackendApplicationTests {

    @Test
    void contextLoads() {
    }
}
