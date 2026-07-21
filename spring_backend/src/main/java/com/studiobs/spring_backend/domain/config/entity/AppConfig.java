package com.studiobs.spring_backend.domain.config.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.UpdateTimestamp;

@Entity
@Table(name = "app_config")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class AppConfig {

    @Id
    @Column(name = "config_key", length = 64, nullable = false, updatable = false)
    private String configKey;

    @Column(name = "config_value", length = 255, nullable = false)
    private String configValue;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    public AppConfig(String configKey, String configValue) {
        this.configKey = configKey;
        this.configValue = configValue;
    }

    public void updateValue(String configValue) {
        this.configValue = configValue;
    }
}
