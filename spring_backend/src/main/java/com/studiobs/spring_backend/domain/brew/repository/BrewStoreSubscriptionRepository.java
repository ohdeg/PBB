package com.studiobs.spring_backend.domain.brew.repository;

import com.studiobs.spring_backend.domain.brew.entity.BrewStoreSubscription;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BrewStoreSubscriptionRepository extends JpaRepository<BrewStoreSubscription, Integer> {

    List<BrewStoreSubscription> findBySubscriberUserIdOrderByCreatedAtDesc(UUID subscriberUserId);

    List<BrewStoreSubscription> findByStoreIdOrderByCreatedAtDesc(UUID storeId);

    Optional<BrewStoreSubscription> findBySubscriberUserIdAndStoreId(UUID subscriberUserId, UUID storeId);

    boolean existsBySubscriberUserIdAndStoreId(UUID subscriberUserId, UUID storeId);

    void deleteBySubscriberUserIdAndStoreId(UUID subscriberUserId, UUID storeId);
}
