package com.studiobs.spring_backend.domain.lotto.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDate;
import java.time.LocalDateTime;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "lotto_draws")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class LottoDraw {

    @Id
    @Column(name = "round")
    private Integer round;

    @Column(name = "main_numbers", nullable = false, length = 32)
    private String mainNumbers;

    @JdbcTypeCode(SqlTypes.TINYINT)
    @Column(name = "bonus_number")
    private Integer bonusNumber;

    @Column(name = "draw_date")
    private LocalDate drawDate;

    @Column(name = "first_prize_amount")
    private Long firstPrizeAmount;

    @Column(name = "first_prize_winner_count")
    private Integer firstPrizeWinnerCount;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @Builder
    public LottoDraw(
            Integer round,
            String mainNumbers,
            Integer bonusNumber,
            LocalDate drawDate,
            Long firstPrizeAmount,
            Integer firstPrizeWinnerCount
    ) {
        this.round = round;
        this.mainNumbers = mainNumbers;
        this.bonusNumber = bonusNumber;
        this.drawDate = drawDate;
        this.firstPrizeAmount = firstPrizeAmount;
        this.firstPrizeWinnerCount = firstPrizeWinnerCount;
    }

    public void update(
            String mainNumbers,
            Integer bonusNumber,
            LocalDate drawDate,
            Long firstPrizeAmount,
            Integer firstPrizeWinnerCount
    ) {
        this.mainNumbers = mainNumbers;
        this.bonusNumber = bonusNumber;
        this.drawDate = drawDate;
        this.firstPrizeAmount = firstPrizeAmount;
        this.firstPrizeWinnerCount = firstPrizeWinnerCount;
    }
}
