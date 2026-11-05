package com.studiobs.spring_backend.migration;

import java.nio.file.Path;
import java.sql.DriverManager;
import org.junit.jupiter.api.Test;
import org.springframework.boot.autoconfigure.AutoConfigurations;
import org.springframework.boot.flyway.autoconfigure.FlywayAutoConfiguration;
import org.springframework.boot.jdbc.autoconfigure.DataSourceAutoConfiguration;
import org.springframework.boot.test.context.ConfigDataApplicationContextInitializer;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.testcontainers.containers.MySQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.MountableFile;

import static org.assertj.core.api.Assertions.assertThat;

@Testcontainers(disabledWithoutDocker = true)
class LocalFlywayIT {
    @Container
    static final MySQLContainer<?> DB = new MySQLContainer<>("mysql:8.0")
            .withDatabaseName("baseball_db")
            .withCopyFileToContainer(MountableFile.forHostPath(
                    Path.of("../infra/mysql/init.sql").toAbsolutePath().normalize()),
                    "/docker-entrypoint-initdb.d/init.sql");

    @Test
    void upgradesExistingVolumeOnlyOnDevAndPreservesRowsOnRestart() throws Exception {
        try (var connection = DriverManager.getConnection(DB.getJdbcUrl(), DB.getUsername(), DB.getPassword());
             var sql = connection.createStatement()) {
            // Only this disposable container: reconstruct the reported partially upgraded volume.
            sql.execute("DROP TABLE tempori_state_mutations, tempori_score_states");
            sql.execute("INSERT INTO app_config(config_key, config_value) VALUES ('migration-test', 'keep')");
            sql.execute("""
                    INSERT INTO tempori_scores
                        (id, owner_id, idempotency_key, fingerprint, title, file_name, format, size_bytes,
                         sha256, object_key, state, created_at, updated_at)
                    VALUES ('score-before-upgrade', 'owner', 'request', 'fingerprint', 'keep score',
                            'score.pdf', 'PDF', 100, 'hash', 'object', 'READY', NOW(), NOW())
                    """);
            var runner = new ApplicationContextRunner()
                    .withInitializer(new ConfigDataApplicationContextInitializer())
                    .withConfiguration(AutoConfigurations.of(DataSourceAutoConfiguration.class,
                            FlywayAutoConfiguration.class))
                    .withUserConfiguration(LocalFlywayConfiguration.class)
                    .withPropertyValues("spring.datasource.url=" + DB.getJdbcUrl(),
                            "spring.datasource.username=" + DB.getUsername(),
                            "spring.datasource.password=" + DB.getPassword());
            runner.withPropertyValues("spring.profiles.active=prod").run(ctx -> {
                assertThat(ctx).hasNotFailed();
                assertThat(ctx).doesNotHaveBean(org.flywaydb.core.Flyway.class);
            });
            runner.withPropertyValues("spring.profiles.active=dev", "spring.flyway.default-schema=other")
                    .run(ctx -> assertThat(ctx.getStartupFailure())
                            .hasRootCauseMessage("Flyway may only manage the baseball_db schema"));
            sql.execute("ALTER TABLE dieta_recipes RENAME COLUMN record_kind TO before_adoption");
            runner.withPropertyValues("spring.profiles.active=dev")
                    .run(ctx -> assertThat(ctx).hasFailed());
            try (var rs = sql.executeQuery("SHOW TABLES LIKE 'flyway_schema_history'")) {
                assertThat(rs.next()).isFalse();
            }
            sql.execute("ALTER TABLE dieta_recipes RENAME COLUMN before_adoption TO record_kind");
            for (int start = 0; start < 2; start++) {
                runner.withPropertyValues("spring.profiles.active=dev").run(ctx -> {
                    assertThat(ctx).hasNotFailed();
                    assertThat(ctx.getBean(org.flywaydb.core.Flyway.class).info().pending()).isEmpty();
                });
                try (var rs = sql.executeQuery("SELECT COUNT(*) FROM flyway_schema_history WHERE success AND version IN ('20261101', '20261102')")) {
                    rs.next();
                    assertThat(rs.getInt(1)).isEqualTo(2);
                }
                try (var rs = sql.executeQuery("SELECT title FROM tempori_scores WHERE id='score-before-upgrade'")) {
                    assertThat(rs.next()).isTrue();
                    assertThat(rs.getString(1)).isEqualTo("keep score");
                }
                sql.execute("SELECT payload FROM tempori_score_states LIMIT 0");
                sql.execute("SELECT request_hash FROM tempori_state_mutations LIMIT 0");
                try (var rs = sql.executeQuery("SELECT config_value FROM app_config WHERE config_key='migration-test'")) {
                    rs.next();
                    assertThat(rs.getString(1)).isEqualTo("keep");
                }
            }
        }
    }
}
