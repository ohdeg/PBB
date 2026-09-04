package com.studiobs.spring_backend.domain.brew.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.studiobs.spring_backend.domain.brew.dto.StockRequest;
import com.studiobs.spring_backend.domain.brew.entity.BrewStore;
import com.studiobs.spring_backend.domain.brew.entity.BrewStoreStock;
import com.studiobs.spring_backend.domain.brew.entity.BrewStoreStockCategory;
import com.studiobs.spring_backend.domain.brew.entity.BrewStoreSubscription;
import com.studiobs.spring_backend.domain.brew.entity.BrewStoreStockUsageDay;
import com.studiobs.spring_backend.domain.brew.repository.BrewStoreRepository;
import com.studiobs.spring_backend.domain.brew.repository.BrewStoreStockCategoryRepository;
import com.studiobs.spring_backend.domain.brew.entity.BrewStoreStockLog;
import com.studiobs.spring_backend.domain.brew.repository.BrewStoreStockLogRepository;
import com.studiobs.spring_backend.domain.brew.repository.BrewStoreStockRepository;
import com.studiobs.spring_backend.domain.brew.repository.BrewStoreStockUsageDayRepository;
import com.studiobs.spring_backend.domain.brew.repository.BrewStoreSubscriptionRepository;
import com.studiobs.spring_backend.domain.brew.support.PosAccess;
import com.studiobs.spring_backend.domain.user.entity.User;
import com.studiobs.spring_backend.domain.user.entity.UserClass;
import com.studiobs.spring_backend.domain.user.service.UserService;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
class BrewStockServiceUsageTest {

    @Mock
    private UserService userService;
    @Mock
    private BrewStoreRepository storeRepository;
    @Mock
    private BrewStoreSubscriptionRepository subscriptionRepository;
    @Mock
    private BrewStoreStockCategoryRepository stockCategoryRepository;
    @Mock
    private BrewStoreStockRepository stockRepository;
    @Mock
    private BrewStoreStockLogRepository stockLogRepository;
    @Mock
    private BrewStoreStockUsageDayRepository usageDayRepository;
    @Mock
    private BrewScheduleService brewScheduleService;
    @Mock
    private VevenoStockCheckService stockCheckService;

    @InjectMocks
    private BrewStockService brewStockService;

    @AfterEach
    void clearPos() {
        PosAccess.clear();
    }

    @Test
    void updateStock_addsBulkDecrease_whenHintOn() {
        UUID ownerId = UUID.randomUUID();
        UUID storeId = UUID.randomUUID();
        stubOwnerUpdate(ownerId, storeId, true, 10);

        brewStockService.updateStock(
                "owner@example.com",
                10,
                new StockRequest("Milk", 3, 1, 0, 7, null, null));

        ArgumentCaptor<BrewStoreStockUsageDay> captor =
                ArgumentCaptor.forClass(BrewStoreStockUsageDay.class);
        verify(usageDayRepository).save(captor.capture());
        assertThat(captor.getValue().getQty()).isEqualTo(7);
    }

    @Test
    void updateStock_doesNotRecord_whenHintOff() {
        UUID ownerId = UUID.randomUUID();
        UUID storeId = UUID.randomUUID();
        stubOwnerUpdate(ownerId, storeId, false, 10);

        brewStockService.updateStock(
                "owner@example.com",
                10,
                new StockRequest("Milk", 3, 1, 0, 7, null, null));

        verify(usageDayRepository, never()).save(any());
        verify(usageDayRepository, never()).findByStockIdAndUsedOn(any(), any());
    }

    @Test
    void updateStock_writesLog_whenQtyChanges() {
        UUID ownerId = UUID.randomUUID();
        UUID storeId = UUID.randomUUID();
        stubOwnerUpdate(ownerId, storeId, false, 10);

        brewStockService.updateStock(
                "owner@example.com",
                10,
                new StockRequest("Milk", 3, 1, 0, 7, null, null));

        ArgumentCaptor<BrewStoreStockLog> captor = ArgumentCaptor.forClass(BrewStoreStockLog.class);
        verify(stockLogRepository).save(captor.capture());
        assertThat(captor.getValue().getFromNum()).isEqualTo(10);
        assertThat(captor.getValue().getToNum()).isEqualTo(3);
        assertThat(captor.getValue().getUserId()).isEqualTo(ownerId);
    }

    @Test
    void updateStock_skipsLog_whenQtyUnchanged() {
        UUID ownerId = UUID.randomUUID();
        UUID storeId = UUID.randomUUID();
        stubOwnerUpdate(ownerId, storeId, false, 10);

        brewStockService.updateStock(
                "owner@example.com",
                10,
                new StockRequest("Milk", 10, 1, 0, 7, "봉지", "https://shop.example/milk"));

        verify(stockLogRepository, never()).save(any());
    }

    @Test
    void listStockLogs_loadsNicknamesInOneQuery() {
        UUID ownerId = UUID.randomUUID();
        UUID storeId = UUID.randomUUID();
        UUID userA = UUID.randomUUID();
        UUID userB = UUID.randomUUID();
        User owner = user("owner@example.com", ownerId);
        BrewStore store = store(storeId, ownerId, false);
        BrewStoreStockCategory category = BrewStoreStockCategory.builder()
                .storeId(storeId)
                .categoryName("Dairy")
                .build();
        ReflectionTestUtils.setField(category, "id", 7);
        BrewStoreStock stock = stock(10, 7, "Milk", 8, 1);
        BrewStoreStockLog logA = new BrewStoreStockLog(10, userA, 9, 8);
        BrewStoreStockLog logB = new BrewStoreStockLog(10, userB, 8, 7);
        ReflectionTestUtils.setField(logA, "id", 1);
        ReflectionTestUtils.setField(logB, "id", 2);

        when(userService.findByEmail("owner@example.com")).thenReturn(Optional.of(owner));
        when(storeRepository.findById(storeId)).thenReturn(Optional.of(store));
        when(stockRepository.findById(10)).thenReturn(Optional.of(stock));
        when(stockCategoryRepository.findById(7)).thenReturn(Optional.of(category));
        when(stockLogRepository.findTop50ByStockIdOrderByIdDesc(10)).thenReturn(List.of(logA, logB));
        when(userService.nicknameMap(any())).thenReturn(Map.of(userA, "민수", userB, "수진"));

        var result = brewStockService.listStockLogs(storeId, 10, "owner@example.com");

        assertThat(result).hasSize(2);
        assertThat(result.get(0).nickname()).isEqualTo("민수");
        assertThat(result.get(1).nickname()).isEqualTo("수진");
        verify(userService).nicknameMap(any());
        verify(stockLogRepository).findTop50ByStockIdOrderByIdDesc(10);
    }

    @Test
    void listStockCategories_loadsUsageInOneQuery() {
        UUID ownerId = UUID.randomUUID();
        UUID storeId = UUID.randomUUID();
        User owner = user("owner@example.com", ownerId);
        BrewStore store = store(storeId, ownerId, true);
        BrewStoreStockCategory category = BrewStoreStockCategory.builder()
                .storeId(storeId)
                .categoryName("Dairy")
                .build();
        ReflectionTestUtils.setField(category, "id", 7);
        BrewStoreStock stockA = stock(10, 7, "Milk", 8, 1);
        BrewStoreStock stockB = stock(11, 7, "Cream", 4, 1);

        when(userService.findByEmail("owner@example.com")).thenReturn(Optional.of(owner));
        when(storeRepository.findById(storeId)).thenReturn(Optional.of(store));
        when(stockCategoryRepository.findByStoreIdOrderByCategoryNameAsc(storeId))
                .thenReturn(List.of(category));
        when(stockRepository.findByCategoryIdInOrderByStockNameAsc(List.of(7)))
                .thenReturn(List.of(stockA, stockB));
        when(usageDayRepository.findByStockIdInAndUsedOnGreaterThanEqual(eq(List.of(10, 11)), any()))
                .thenReturn(List.of());

        brewStockService.listStockCategories(storeId, "owner@example.com");

        verify(usageDayRepository).findByStockIdInAndUsedOnGreaterThanEqual(eq(List.of(10, 11)), any());
        verify(usageDayRepository, never()).findByStockIdAndUsedOnGreaterThanEqual(any(), any());
    }

    @Test
    void listStockCategories_includesOrderUrl_forOwner() {
        UUID ownerId = UUID.randomUUID();
        UUID storeId = UUID.randomUUID();
        stubListStocks(ownerId, storeId, ownerId, "owner@example.com");

        var result = brewStockService.listStockCategories(storeId, "owner@example.com");

        assertThat(result.get(0).stocks().get(0).orderUrl()).isEqualTo("https://shop.example/milk");
    }

    @Test
    void listStockCategories_hidesOrderUrl_forStaff() {
        UUID ownerId = UUID.randomUUID();
        UUID staffId = UUID.randomUUID();
        UUID storeId = UUID.randomUUID();
        stubListStocks(ownerId, storeId, staffId, "staff@example.com");
        when(subscriptionRepository.findBySubscriberUserIdAndStoreId(staffId, storeId))
                .thenReturn(Optional.of(BrewStoreSubscription.builder()
                        .subscriberUserId(staffId)
                        .storeId(storeId)
                        .canEditStock(true)
                        .build()));

        var result = brewStockService.listStockCategories(storeId, "staff@example.com");

        assertThat(result.get(0).stocks().get(0).orderUrl()).isNull();
    }

    @Test
    void updateStock_ignoresOrderUrl_forStaff() {
        UUID ownerId = UUID.randomUUID();
        UUID staffId = UUID.randomUUID();
        UUID storeId = UUID.randomUUID();
        BrewStoreStock stock = stubStaffUpdate(ownerId, staffId, storeId, 10);

        var result = brewStockService.updateStock(
                "staff@example.com",
                10,
                new StockRequest(
                        "Milk",
                        10,
                        1,
                        0,
                        7,
                        null,
                        "https://evil.example/steal"));

        assertThat(stock.getOrderUrl()).isEqualTo("https://shop.example/milk");
        assertThat(result.orderUrl()).isNull();
    }

    @Test
    void updateStock_posWithoutEdit_qtyOnlyWhenRequested() {
        UUID ownerId = UUID.randomUUID();
        UUID posUser = UUID.randomUUID();
        UUID storeId = UUID.randomUUID();
        BrewStore store = store(storeId, ownerId, false);
        BrewStoreStockCategory category = BrewStoreStockCategory.builder()
                .storeId(storeId)
                .categoryName("Dairy")
                .build();
        ReflectionTestUtils.setField(category, "id", 7);
        BrewStoreStock stock = stock(10, 7, "Milk", 10, 1);
        when(userService.findByEmail("pos@example.com"))
                .thenReturn(Optional.of(user("pos@example.com", posUser)));
        when(storeRepository.findById(storeId)).thenReturn(Optional.of(store));
        when(stockRepository.findById(10)).thenReturn(Optional.of(stock));
        when(stockCategoryRepository.findById(7)).thenReturn(Optional.of(category));
        when(stockRepository.save(stock)).thenReturn(stock);
        when(stockCheckService.isRequested(storeId, 10)).thenReturn(true);
        PosAccess.set(new PosAccess.Snapshot(posUser, storeId, false, "dev"));

        var result = brewStockService.updateStock(
                "pos@example.com",
                10,
                new StockRequest("Hacked", 4, 99, 0, 99, "박스", "https://evil.example"));

        assertThat(result.stockNum()).isEqualTo(4);
        assertThat(stock.getStockName()).isEqualTo("Milk");
        assertThat(stock.getStockMinNum()).isEqualTo(1);
        assertThat(stock.getUnit()).isEqualTo("개");
    }

    private void stubListStocks(UUID ownerId, UUID storeId, UUID viewerId, String email) {
        User viewer = user(email, viewerId);
        BrewStore store = store(storeId, ownerId, false);
        BrewStoreStockCategory category = BrewStoreStockCategory.builder()
                .storeId(storeId)
                .categoryName("Dairy")
                .build();
        ReflectionTestUtils.setField(category, "id", 7);
        BrewStoreStock milk = stock(10, 7, "Milk", 8, 1);
        ReflectionTestUtils.setField(milk, "orderUrl", "https://shop.example/milk");

        when(userService.findByEmail(email)).thenReturn(Optional.of(viewer));
        when(storeRepository.findById(storeId)).thenReturn(Optional.of(store));
        when(stockCategoryRepository.findByStoreIdOrderByCategoryNameAsc(storeId))
                .thenReturn(List.of(category));
        when(stockRepository.findByCategoryIdInOrderByStockNameAsc(List.of(7)))
                .thenReturn(List.of(milk));
    }

    private BrewStoreStock stubStaffUpdate(UUID ownerId, UUID staffId, UUID storeId, int currentNum) {
        User staff = user("staff@example.com", staffId);
        BrewStore store = store(storeId, ownerId, false);
        BrewStoreStockCategory category = BrewStoreStockCategory.builder()
                .storeId(storeId)
                .categoryName("Dairy")
                .build();
        ReflectionTestUtils.setField(category, "id", 7);
        BrewStoreStock stock = stock(10, 7, "Milk", currentNum, 1);
        ReflectionTestUtils.setField(stock, "orderUrl", "https://shop.example/milk");

        when(userService.findByEmail("staff@example.com")).thenReturn(Optional.of(staff));
        when(storeRepository.findById(storeId)).thenReturn(Optional.of(store));
        when(subscriptionRepository.findBySubscriberUserIdAndStoreId(staffId, storeId))
                .thenReturn(Optional.of(BrewStoreSubscription.builder()
                        .subscriberUserId(staffId)
                        .storeId(storeId)
                        .canEditStock(true)
                        .build()));
        when(brewScheduleService.isCurrentlyOnDuty(storeId, staffId)).thenReturn(true);
        when(stockRepository.findById(10)).thenReturn(Optional.of(stock));
        when(stockCategoryRepository.findById(7)).thenReturn(Optional.of(category));
        when(stockRepository.existsByCategoryIdAndStockNameAndIdNot(7, "Milk", 10)).thenReturn(false);
        when(stockRepository.save(stock)).thenReturn(stock);
        return stock;
    }

    private BrewStoreStock stubOwnerUpdate(UUID ownerId, UUID storeId, boolean hintOn, int currentNum) {
        User owner = user("owner@example.com", ownerId);
        BrewStore store = store(storeId, ownerId, hintOn);
        BrewStoreStockCategory category = BrewStoreStockCategory.builder()
                .storeId(storeId)
                .categoryName("Dairy")
                .build();
        ReflectionTestUtils.setField(category, "id", 7);
        BrewStoreStock stock = stock(10, 7, "Milk", currentNum, 1);

        when(userService.findByEmail("owner@example.com")).thenReturn(Optional.of(owner));
        when(storeRepository.findById(storeId)).thenReturn(Optional.of(store));
        when(stockRepository.findById(10)).thenReturn(Optional.of(stock));
        when(stockCategoryRepository.findById(7)).thenReturn(Optional.of(category));
        when(stockRepository.existsByCategoryIdAndStockNameAndIdNot(7, "Milk", 10)).thenReturn(false);
        when(stockRepository.save(stock)).thenReturn(stock);
        if (hintOn) {
            when(usageDayRepository.findByStockIdAndUsedOn(eq(10), any(LocalDate.class)))
                    .thenReturn(Optional.empty());
            when(usageDayRepository.findByStockIdAndUsedOnGreaterThanEqual(eq(10), any()))
                    .thenReturn(List.of());
        }
        return stock;
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

    private static BrewStore store(UUID id, UUID ownerId, boolean hintOn) {
        BrewStore store = BrewStore.builder()
                .ownerUserId(ownerId)
                .name("Cafe")
                .isPublic(true)
                .inviteCode("ABCD1234")
                .build();
        ReflectionTestUtils.setField(store, "id", id);
        ReflectionTestUtils.setField(store, "stockUsageHint", hintOn);
        return store;
    }

    private static BrewStoreStock stock(
            int id,
            int categoryId,
            String name,
            int num,
            int min
    ) {
        BrewStoreStock stock = BrewStoreStock.builder()
                .categoryId(categoryId)
                .stockName(name)
                .stockNum(num)
                .stockMinNum(min)
                .build();
        ReflectionTestUtils.setField(stock, "id", id);
        ReflectionTestUtils.setField(stock, "version", 0);
        return stock;
    }
}
