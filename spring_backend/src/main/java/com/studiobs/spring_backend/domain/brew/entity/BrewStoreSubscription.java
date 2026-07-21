package com.studiobs.spring_backend.domain.brew.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDate;
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

    /** 첫 근무일. 이 날짜 전부터는 정규 근무로 취급하지 않음 */
    @Column(name = "work_start_date")
    private LocalDate workStartDate;

    /** 마지막 근무일. 이 날짜가 지나면 구독 해제 대상 */
    @Column(name = "leave_date")
    private LocalDate leaveDate;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @Builder
    public BrewStoreSubscription(
            UUID subscriberUserId,
            UUID storeId,
            boolean canEditStock,
            LocalDate workStartDate
    ) {
        this.subscriberUserId = subscriberUserId;
        this.storeId = storeId;
        this.canEditStock = canEditStock;
        this.workStartDate = workStartDate;
    }

    public void setCanEditStock(boolean canEditStock) {
        this.canEditStock = canEditStock;
    }

    public void setWorkStartDate(LocalDate workStartDate) {
        this.workStartDate = workStartDate;
    }

    public void scheduleLeave(LocalDate leaveDate) {
        this.leaveDate = leaveDate;
    }

    public void clearLeave() {
        this.leaveDate = null;
    }

    public boolean isLeaveDue(LocalDate today) {
        return leaveDate != null && today.isAfter(leaveDate);
    }

    /** 해당 날짜에 정규 근무가 유효한지 (시작일~퇴사일) */
    public boolean isActiveOn(LocalDate date) {
        if (workStartDate != null && date.isBefore(workStartDate)) {
            return false;
        }
        if (leaveDate != null && date.isAfter(leaveDate)) {
            return false;
        }
        return true;
    }
}
