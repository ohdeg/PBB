package com.studiobs.spring_backend.domain.brew.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import java.util.UUID;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UuidGenerator;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "brew_pos_devices")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class BrewPosDevice {

    @Id
    @GeneratedValue
    @UuidGenerator
    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(length = 36, updatable = false, nullable = false)
    private UUID id;

    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(name = "store_id", nullable = false, length = 36)
    private UUID storeId;

    @Column(name = "device_id", nullable = false, length = 64)
    private String deviceId;

    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(name = "enrolled_by_user_id", nullable = false, length = 36)
    private UUID enrolledByUserId;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @Builder
    public BrewPosDevice(UUID storeId, String deviceId, UUID enrolledByUserId) {
        this.storeId = storeId;
        this.deviceId = deviceId;
        this.enrolledByUserId = enrolledByUserId;
    }
}
