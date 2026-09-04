package com.studiobs.spring_backend.domain.brew.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.studiobs.spring_backend.domain.brew.dto.StockCheckRecord;
import com.studiobs.spring_backend.domain.brew.dto.StockCheckResponse;
import com.studiobs.spring_backend.domain.brew.entity.BrewStore;
import com.studiobs.spring_backend.domain.brew.entity.BrewStoreStock;
import com.studiobs.spring_backend.domain.brew.entity.BrewStoreStockCategory;
import com.studiobs.spring_backend.domain.brew.repository.BrewStoreRepository;
import com.studiobs.spring_backend.domain.brew.repository.BrewStoreStockCategoryRepository;
import com.studiobs.spring_backend.domain.brew.repository.BrewStoreStockRepository;
import com.studiobs.spring_backend.domain.brew.support.PosAccess;
import com.studiobs.spring_backend.domain.user.entity.User;
import com.studiobs.spring_backend.domain.user.entity.UserClass;
import com.studiobs.spring_backend.domain.user.service.UserService;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.test.util.ReflectionTestUtils;
import tools.jackson.databind.json.JsonMapper;

@ExtendWith(MockitoExtension.class)
class VevenoStockCheckServiceTest {

    @Mock
    private UserService userService;
    @Mock
    private BrewStoreRepository storeRepository;
    @Mock
    private BrewStoreStockRepository stockRepository;
    @Mock
    private BrewStoreStockCategoryRepository stockCategoryRepository;
    @Mock
    private StringRedisTemplate stringRedisTemplate;
    @Mock
    private ValueOperations<String, String> valueOperations;
    @Mock
    private com.studiobs.spring_backend.domain.brew.ws.VevenoWsPublisher wsPublisher;

    private VevenoStockCheckService service;
    private final JsonMapper mapper = JsonMapper.builder().build();
    private final java.util.Map<Integer, BrewStoreStock> stocks = new java.util.HashMap<>();

    private UUID ownerId;
    private UUID storeId;

    @BeforeEach
    void setUp() {
        stocks.clear();
        when(stringRedisTemplate.opsForValue()).thenReturn(valueOperations);
        lenient().when(stockRepository.findAllById(any())).thenAnswer(inv -> {
            Iterable<Integer> ids = inv.getArgument(0);
            java.util.List<BrewStoreStock> found = new java.util.ArrayList<>();
            for (Integer id : ids) {
                BrewStoreStock stock = stocks.get(id);
                if (stock != null) {
                    found.add(stock);
                }
            }
            return found;
        });
        service = new VevenoStockCheckService(
                userService,
                storeRepository,
                stockRepository,
                stockCategoryRepository,
                stringRedisTemplate,
                mapper,
                wsPublisher);
        ownerId = UUID.randomUUID();
        storeId = UUID.randomUUID();
    }

    @AfterEach
    void tearDown() {
        PosAccess.clear();
    }

    @Test
    void upsert_createsThenMergesWithoutNewRequestId() {
        stubOwner();
        stubStock(10, "Milk");
        stubStock(11, "Beans");
        when(valueOperations.get(VevenoStockCheckService.openKey(storeId))).thenReturn(null);

        StockCheckResponse first = service.upsert("owner@example.com", storeId, List.of(10));
        ArgumentCaptor<String> json = ArgumentCaptor.forClass(String.class);
        verify(valueOperations).set(
                eq(VevenoStockCheckService.openKey(storeId)),
                json.capture(),
                eq(VevenoStockCheckService.TTL));
        when(valueOperations.get(VevenoStockCheckService.openKey(storeId))).thenReturn(json.getValue());

        StockCheckResponse second = service.upsert("owner@example.com", storeId, List.of(11, 10));

        assertThat(second.requestId()).isEqualTo(first.requestId());
        assertThat(second.items()).extracting(item -> item.id()).containsExactly(10, 11);
        verify(wsPublisher, org.mockito.Mockito.atLeastOnce()).publish(any());
    }

    @Test
    void remove_lastItemClearsOpen() {
        stubOwner();
        StockCheckRecord open = new StockCheckRecord(
                "req-1",
                List.of(10),
                Instant.now(),
                Instant.now(),
                ownerId.toString());
        when(valueOperations.get(VevenoStockCheckService.openKey(storeId)))
                .thenReturn(mapper.writeValueAsString(open));

        assertThat(service.remove("owner@example.com", storeId, List.of(10))).isNull();
        verify(stringRedisTemplate).delete(VevenoStockCheckService.openKey(storeId));
    }

    @Test
    void complete_movesOpenToDone() {
        PosAccess.set(new PosAccess.Snapshot(ownerId, storeId, false, "dev"));
        when(userService.findByEmail("pos@example.com"))
                .thenReturn(Optional.of(user("pos@example.com", ownerId)));
        StockCheckRecord open = new StockCheckRecord(
                "req-1",
                List.of(10),
                Instant.parse("2026-09-04T00:00:00Z"),
                Instant.parse("2026-09-04T00:00:00Z"),
                ownerId.toString());
        when(valueOperations.get(VevenoStockCheckService.openKey(storeId)))
                .thenReturn(mapper.writeValueAsString(open));

        service.complete("pos@example.com", storeId);

        ArgumentCaptor<String> json = ArgumentCaptor.forClass(String.class);
        verify(valueOperations).set(
                eq(VevenoStockCheckService.doneKey(storeId)),
                json.capture(),
                eq(VevenoStockCheckService.TTL));
        StockCheckRecord done = mapper.readValue(json.getValue(), StockCheckRecord.class);
        assertThat(done.requestId()).isEqualTo("req-1");
        assertThat(done.stockIds()).containsExactly(10);
        verify(stringRedisTemplate).delete(VevenoStockCheckService.openKey(storeId));
    }

    @Test
    void isRequested_trueOnlyForOpenIds() {
        StockCheckRecord open = new StockCheckRecord(
                "req-1",
                List.of(10, 11),
                Instant.now(),
                Instant.now(),
                ownerId.toString());
        when(valueOperations.get(VevenoStockCheckService.openKey(storeId)))
                .thenReturn(mapper.writeValueAsString(open));

        assertThat(service.isRequested(storeId, 10)).isTrue();
        assertThat(service.isRequested(storeId, 99)).isFalse();
    }

    private void stubOwner() {
        when(userService.findByEmail("owner@example.com"))
                .thenReturn(Optional.of(user("owner@example.com", ownerId)));
        BrewStore store = BrewStore.builder()
                .ownerUserId(ownerId)
                .name("Cafe")
                .isPublic(true)
                .inviteCode("ABCD1234")
                .build();
        ReflectionTestUtils.setField(store, "id", storeId);
        when(storeRepository.findById(storeId)).thenReturn(Optional.of(store));
    }

    private void stubStock(int id, String name) {
        BrewStoreStock stock = BrewStoreStock.builder()
                .categoryId(7)
                .stockName(name)
                .stockNum(3)
                .stockMinNum(1)
                .build();
        ReflectionTestUtils.setField(stock, "id", id);
        ReflectionTestUtils.setField(stock, "version", 0);
        stocks.put(id, stock);
        BrewStoreStockCategory category = BrewStoreStockCategory.builder()
                .storeId(storeId)
                .categoryName("Dairy")
                .build();
        ReflectionTestUtils.setField(category, "id", 7);
        when(stockCategoryRepository.findById(7)).thenReturn(Optional.of(category));
    }

    private static User user(String email, UUID id) {
        User u = User.builder()
                .email(email)
                .password("hash")
                .nickname("n")
                .userClass(UserClass.FREE)
                .build();
        ReflectionTestUtils.setField(u, "id", id);
        return u;
    }
}
