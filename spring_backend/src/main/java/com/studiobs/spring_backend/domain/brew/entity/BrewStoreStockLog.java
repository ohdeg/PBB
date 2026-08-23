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
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "brew_store_stock_logs")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class BrewStoreStockLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(name = "stock_id", nullable = false)
    private Integer stockId;

    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(name = "user_id", nullable = false, length = 36)
    private UUID userId;

    @Column(name = "from_num", nullable = false)
    private int fromNum;

    @Column(name = "to_num", nullable = false)
    private int toNum;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    public BrewStoreStockLog(Integer stockId, UUID userId, int fromNum, int toNum) {
        this.stockId = stockId;
        this.userId = userId;
        this.fromNum = fromNum;
        this.toNum = toNum;
    }
}
