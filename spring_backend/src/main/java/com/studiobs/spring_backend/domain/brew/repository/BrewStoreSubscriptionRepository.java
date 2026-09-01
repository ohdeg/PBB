package com.studiobs.spring_backend.domain.brew.repository;

import com.studiobs.spring_backend.domain.brew.entity.BrewStoreSubscription;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BrewStoreSubscriptionRepository extends JpaRepository<BrewStoreSubscription, Integer> {

    List<BrewStoreSubscription> findBySubscriberUserIdOrderByCreatedAtDesc(UUID subscriberUserId);

    List<BrewStoreSubscription> findByStoreIdOrderByCreatedAtDesc(UUID storeId);

    /** leave_date &lt; date. null leave_date 제외. 확정은 lastShiftEnd 추가 확인. */
    List<BrewStoreSubscription> findBySubscriberUserIdAndLeaveDateBefore(
            UUID subscriberUserId,
            LocalDate date
    );

    List<BrewStoreSubscription> findByStoreIdAndLeaveDateBefore(UUID storeId, LocalDate date);

    List<BrewStoreSubscription> findByLeaveDateBefore(LocalDate date);

    List<BrewStoreSubscription> findBySubscriberUserIdAndStoreIdIn(
            UUID subscriberUserId,
            Collection<UUID> storeIds
    );

    Optional<BrewStoreSubscription> findBySubscriberUserIdAndStoreId(UUID subscriberUserId, UUID storeId);

    boolean existsBySubscriberUserIdAndStoreId(UUID subscriberUserId, UUID storeId);

    void deleteBySubscriberUserIdAndStoreId(UUID subscriberUserId, UUID storeId);
}
