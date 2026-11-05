package com.studiobs.spring_backend.migration;

import java.sql.SQLException;
import java.util.Arrays;
import java.util.regex.Pattern;
import org.springframework.boot.flyway.autoconfigure.FlywayMigrationStrategy;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;

@Configuration(proxyBeanMethods = false)
public class LocalFlywayConfiguration {
    // Match only the single-host Connector/J form used by local Compose / Testcontainers.
    private static final Pattern LOCAL_DATABASE = Pattern.compile(
            "jdbc:mysql://(?:localhost|127\\.0\\.0\\.1|\\[::1\\])(?::[0-9]+)?/baseball_db(?:\\?.*)?");

    @Bean
    FlywayMigrationStrategy localOnlyMigration(Environment environment) {
        return flyway -> {
            if (!environment.matchesProfiles("dev & !prod & !test")) {
                throw new IllegalStateException("Automatic Flyway migrations require the local dev profile");
            }
            var config = flyway.getConfiguration();
            if ((config.getDefaultSchema() != null && !"baseball_db".equals(config.getDefaultSchema()))
                    || Arrays.stream(config.getSchemas()).anyMatch(schema -> !"baseball_db".equals(schema))) {
                throw new IllegalStateException("Flyway may only manage the baseball_db schema");
            }
            try (var connection = config.getDataSource().getConnection();
                 var sql = connection.createStatement()) {
                if (!LOCAL_DATABASE.matcher(connection.getMetaData().getURL()).matches()
                        || !"baseball_db".equals(connection.getCatalog())) {
                    throw new IllegalStateException("Flyway requires the local MySQL baseball_db database");
                }
                // Check the adoption point before Flyway creates its baseline; never replay legacy DDL.
                try (var history = sql.executeQuery("SELECT COUNT(*) FROM information_schema.tables "
                        + "WHERE table_schema = DATABASE() AND table_name = 'flyway_schema_history'")) {
                    history.next();
                    if (history.getInt(1) == 0) {
                        try (var probe = connection.createStatement()) {
                            probe.executeQuery("SELECT u.id, r.record_kind FROM users u, dieta_recipes r LIMIT 0").close();
                        }
                    }
                }
            } catch (SQLException e) {
                throw new IllegalStateException("Cannot adopt local PBB schema: check MySQL connectivity, "
                        + "Compose initialization and the 20261031 Dieta migration", e);
            }
            flyway.migrate();
        };
    }
}
