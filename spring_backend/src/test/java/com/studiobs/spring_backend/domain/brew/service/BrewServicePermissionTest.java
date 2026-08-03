package com.studiobs.spring_backend.domain.brew.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.studiobs.spring_backend.domain.brew.dto.StockRequest;
import com.studiobs.spring_backend.domain.brew.entity.BrewStore;
import com.studiobs.spring_backend.domain.brew.entity.BrewStoreStockCategory;
import com.studiobs.spring_backend.domain.brew.entity.BrewStoreSubscription;
import com.studiobs.spring_backend.domain.brew.repository.BrewMenuRepository;
import com.studiobs.spring_backend.domain.brew.repository.BrewRecipeRepository;
import com.studiobs.spring_backend.domain.brew.repository.BrewStoreNoticeRepository;
import com.studiobs.spring_backend.domain.brew.repository.BrewStoreRepository;
import com.studiobs.spring_backend.domain.brew.repository.BrewStoreStockCategoryRepository;
import com.studiobs.spring_backend.domain.brew.repository.BrewStoreStockRepository;
import com.studiobs.spring_backend.domain.brew.repository.BrewStoreSubscriptionRepository;
import com.studiobs.spring_backend.domain.user.entity.User;
import com.studiobs.spring_backend.domain.user.entity.UserClass;
import com.studiobs.spring_backend.domain.user.service.UserService;
import com.studiobs.spring_backend.global.exception.BusinessException;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
class BrewServicePermissionTest {

    @Mock
    private UserService userService;
    @Mock
    private BrewStoreRepository storeRepository;
    @Mock
    private BrewMenuRepository menuRepository;
    @Mock
    private BrewRecipeRepository recipeRepository;
    @Mock
    private BrewStoreSubscriptionRepository subscriptionRepository;
    @Mock
    private BrewStoreStockCategoryRepository stockCategoryRepository;
    @Mock
    private BrewStoreStockRepository stockRepository;
    @Mock
    private BrewStoreNoticeRepository noticeRepository;
    @Mock
    private BrewRedisService brewRedisService;
    @Mock
    private BrewScheduleService brewScheduleService;

    @InjectMocks
    private BrewService brewService;

    @InjectMocks
    private BrewStockService brewStockService;

    @Test
    void deleteStore_forbidden_whenNotOwner() {
        UUID ownerId = UUID.randomUUID();
        UUID otherId = UUID.randomUUID();
        UUID storeId = UUID.randomUUID();

        User other = user("other@example.com", otherId);
        BrewStore store = store(storeId, ownerId);

        when(userService.findByEmail("other@example.com")).thenReturn(Optional.of(other));
        when(storeRepository.findById(storeId)).thenReturn(Optional.of(store));

        assertThatThrownBy(() -> brewService.deleteStore("other@example.com", storeId))
                .isInstanceOf(BusinessException.class)
                .satisfies(ex -> {
                    BusinessException be = (BusinessException) ex;
                    assertThat(be.getStatus()).isEqualTo(HttpStatus.FORBIDDEN);
                });

        verify(storeRepository, never()).delete(any());
    }

    @Test
    void createStock_forbidden_whenCanEditStockFalse() {
        UUID ownerId = UUID.randomUUID();
        UUID staffId = UUID.randomUUID();
        UUID storeId = UUID.randomUUID();
        int categoryId = 7;

        User staff = user("staff@example.com", staffId);
        BrewStore store = store(storeId, ownerId);
        BrewStoreStockCategory category = BrewStoreStockCategory.builder()
                .storeId(storeId)
                .categoryName("Beans")
                .build();
        ReflectionTestUtils.setField(category, "id", categoryId);

        BrewStoreSubscription sub = BrewStoreSubscription.builder()
                .subscriberUserId(staffId)
                .storeId(storeId)
                .canEditStock(false)
                .build();

        when(userService.findByEmail("staff@example.com")).thenReturn(Optional.of(staff));
        when(stockCategoryRepository.findById(categoryId)).thenReturn(Optional.of(category));
        when(storeRepository.findById(storeId)).thenReturn(Optional.of(store));
        when(subscriptionRepository.findBySubscriberUserIdAndStoreId(staffId, storeId))
                .thenReturn(Optional.of(sub));

        assertThatThrownBy(() -> brewStockService.createStock(
                        "staff@example.com",
                        categoryId,
                        new StockRequest("Milk", 10, 2, null)))
                .isInstanceOf(BusinessException.class)
                .satisfies(ex -> {
                    BusinessException be = (BusinessException) ex;
                    assertThat(be.getStatus()).isEqualTo(HttpStatus.FORBIDDEN);
                    assertThat(be.getMessage()).contains("재고 수정 권한");
                });

        verify(stockRepository, never()).save(any());
    }

    private static User user(String email, UUID id) {
        User u = User.builder()
                .email(email)
                .password("hash")
                .nickname(email.split("@")[0])
                .userClass(UserClass.FREE)
                .build();
        ReflectionTestUtils.setField(u, "id", id);
        return u;
    }

    private static BrewStore store(UUID id, UUID ownerId) {
        BrewStore store = BrewStore.builder()
                .ownerUserId(ownerId)
                .name("Cafe")
                .isPublic(true)
                .inviteCode("ABCD1234")
                .build();
        ReflectionTestUtils.setField(store, "id", id);
        return store;
    }
}
