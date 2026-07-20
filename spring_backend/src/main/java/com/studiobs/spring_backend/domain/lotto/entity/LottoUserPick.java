package com.studiobs.spring_backend.domain.lotto.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import java.util.UUID;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "lotto_user_picks")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class LottoUserPick {

    @Id
    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(name = "user_id", length = 36, nullable = false)
    private UUID userId;

    @Column(name = "target_round")
    private Integer targetRound;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "items", nullable = false, columnDefinition = "json")
    private String items;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @Builder
    public LottoUserPick(UUID userId, Integer targetRound, String items) {
        this.userId = userId;
        this.targetRound = targetRound;
        this.items = items;
    }

    public void update(Integer targetRound, String items) {
        this.targetRound = targetRound;
        this.items = items;
    }
}
