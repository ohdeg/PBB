package com.studiobs.spring_backend;

import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.Test;

/**
 * Prefer {@link ContextLoadsIT} (Testcontainers). Kept disabled so local runs without Docker
 * do not fail on a full Spring context against host MySQL/Redis.
 */
@Disabled("Replaced by ContextLoadsIT with Testcontainers.")
class SpringBackendApplicationTests {

    @Test
    void contextLoads() {
    }
}
