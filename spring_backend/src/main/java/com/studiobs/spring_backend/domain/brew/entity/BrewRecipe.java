package com.studiobs.spring_backend.domain.brew.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Lob;
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
@Table(name = "brew_recipes")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class BrewRecipe {

    @Id
    @GeneratedValue
    @UuidGenerator
    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(length = 36, updatable = false, nullable = false)
    private UUID id;

    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(name = "menu_id", nullable = false, length = 36)
    private UUID menuId;

    @Lob
    @Column(nullable = false, columnDefinition = "LONGTEXT")
    private String contents;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @Builder
    public BrewRecipe(UUID menuId, String contents) {
        this.menuId = menuId;
        this.contents = contents;
    }

    public void updateContents(String contents) {
        this.contents = contents;
    }
}
