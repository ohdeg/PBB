package com.studiobs.spring_backend.support;

import com.redis.testcontainers.RedisContainer;
import java.nio.file.Files;
import java.nio.file.Path;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.MySQLContainer;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.MountableFile;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Testcontainers(disabledWithoutDocker = true)
public abstract class AbstractIntegrationTest {

    static final MySQLContainer<?> MYSQL;
    static final RedisContainer REDIS;

    static {
        Path initSql = resolveInitSql();
        MYSQL = new MySQLContainer<>("mysql:8.0")
                .withDatabaseName("baseball_db")
                .withUsername("baseball_user")
                .withPassword("baseball_password")
                .withCopyFileToContainer(
                        MountableFile.forHostPath(initSql),
                        "/docker-entrypoint-initdb.d/init.sql");
        REDIS = new RedisContainer("redis:7.0-alpine");
        MYSQL.start();
        REDIS.start();
    }

    @DynamicPropertySource
    static void registerProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", MYSQL::getJdbcUrl);
        registry.add("spring.datasource.username", MYSQL::getUsername);
        registry.add("spring.datasource.password", MYSQL::getPassword);
        registry.add("spring.datasource.driver-class-name", () -> "com.mysql.cj.jdbc.Driver");
        registry.add("spring.data.redis.host", REDIS::getHost);
        registry.add("spring.data.redis.port", () -> REDIS.getMappedPort(6379));
    }

    private static Path resolveInitSql() {
        Path fromModule = Path.of(System.getProperty("user.dir"), "..", "infra", "mysql", "init.sql")
                .normalize();
        if (Files.isRegularFile(fromModule)) {
            return fromModule;
        }
        Path fromRoot = Path.of(System.getProperty("user.dir"), "infra", "mysql", "init.sql")
                .normalize();
        if (Files.isRegularFile(fromRoot)) {
            return fromRoot;
        }
        throw new IllegalStateException(
                "infra/mysql/init.sql not found from " + System.getProperty("user.dir"));
    }
}
