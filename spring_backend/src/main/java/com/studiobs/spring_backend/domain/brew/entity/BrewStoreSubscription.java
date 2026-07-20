package com.studiobs.spring_backend.domain.brew.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
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
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "brew_store_subscriptions")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class BrewStoreSubscription {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(name = "subscriber_user_id", nullable = false, length = 36)
    private UUID subscriberUserId;

    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(name = "store_id", nullable = false, length = 36)
    private UUID storeId;

    @Column(name = "can_edit_stock", nullable = false)
    private boolean canEditStock;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @Builder
    public BrewStoreSubscription(UUID subscriberUserId, UUID storeId, boolean canEditStock) {
        this.subscriberUserId = subscriberUserId;
        this.storeId = storeId;
        this.canEditStock = canEditStock;
    }

    public void setCanEditStock(boolean canEditStock) {
        this.canEditStock = canEditStock;
    }
}
