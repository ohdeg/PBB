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
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.annotations.UuidGenerator;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "brew_stores")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class BrewStore {

    @Id
    @GeneratedValue
    @UuidGenerator
    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(length = 36, updatable = false, nullable = false)
    private UUID id;

    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(name = "owner_user_id", nullable = false, length = 36)
    private UUID ownerUserId;

    @Column(nullable = false, length = 120)
    private String name;

    @Column(name = "is_public", nullable = false)
    private boolean isPublic;

    @Column(name = "invite_code", nullable = false, length = 8, unique = true)
    private String inviteCode;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @Builder
    public BrewStore(UUID ownerUserId, String name, boolean isPublic, String inviteCode) {
        this.ownerUserId = ownerUserId;
        this.name = name;
        this.isPublic = isPublic;
        this.inviteCode = inviteCode;
    }

    public void update(String name, boolean isPublic) {
        this.name = name;
        this.isPublic = isPublic;
    }

    public void rotateInviteCode(String inviteCode) {
        this.inviteCode = inviteCode;
    }
}
