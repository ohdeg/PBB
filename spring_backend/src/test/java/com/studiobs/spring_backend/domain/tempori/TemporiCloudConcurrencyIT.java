package com.studiobs.spring_backend.domain.tempori;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.doAnswer;
import com.studiobs.spring_backend.domain.user.entity.User;
import com.studiobs.spring_backend.domain.user.repository.UserRepository;
import com.studiobs.spring_backend.global.exception.BusinessException;
import com.studiobs.spring_backend.support.AbstractIntegrationTest;
import java.nio.charset.StandardCharsets;
import java.util.UUID;
import java.util.concurrent.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

/** Requires the project's isolated MySQL/Redis Testcontainers setup; no live R2. */
@TestPropertySource(properties={"tempori.max-user-files=1", "tempori.r2-bucket=", "tempori.cleanup-interval-ms=86400000"})
class TemporiCloudConcurrencyIT extends AbstractIntegrationTest {
    @Autowired TemporiCloudService service;
    @Autowired UserRepository users;
    @Autowired TemporiScoreRepository scores;
    @Autowired PlatformTransactionManager manager;
    @MockitoBean TemporiPrivateStorage storage;
    private final MockMultipartFile file=new MockMultipartFile("file","score.xml","application/xml","<score-partwise><part-list/></score-partwise>".getBytes(StandardCharsets.UTF_8));
    private User account() { String unique=UUID.randomUUID().toString(); return users.saveAndFlush(User.builder().email(unique+"@example.test").nickname(unique).password("test-only-not-a-login-hash").build()); }

    @Test void concurrentUploadCountsTheCommittedReservationBeforeR2Completes() throws Exception {
        User owner=account(); var inStorage=new CountDownLatch(1); var release=new CountDownLatch(1);
        doAnswer(call -> { inStorage.countDown(); assertTrue(release.await(10,TimeUnit.SECONDS)); return null; }).when(storage).put(anyString(),any(),anyString());
        try(var executor=Executors.newSingleThreadExecutor()) {
            var first=executor.submit(() -> service.upload(owner.getId(),"first-request",file,"First",null));
            try {
                assertTrue(inStorage.await(10,TimeUnit.SECONDS));
                var error=assertThrows(BusinessException.class,()->service.upload(owner.getId(),"second-request",file,"Second",null));
                assertEquals(413,error.getStatus().value());
            } finally { release.countDown(); }
            assertNotNull(first.get(10,TimeUnit.SECONDS));
        }
    }

    @Test void accountDeletionSeesAnUploadCommittedAfterItsRepeatableReadSnapshot() throws Exception {
        User owner=account(); var snapshot=new CountDownLatch(1); var uploaded=new CountDownLatch(1);
        var tx=new TransactionTemplate(manager); tx.setIsolationLevel(TransactionDefinition.ISOLATION_REPEATABLE_READ);
        try(var executor=Executors.newSingleThreadExecutor()) {
            var deletion=executor.submit(() -> tx.executeWithoutResult(status -> {
                User loaded=users.findById(owner.getId()).orElseThrow(); snapshot.countDown();
                try { assertTrue(uploaded.await(10,TimeUnit.SECONDS)); } catch(InterruptedException error) { Thread.currentThread().interrupt(); throw new RuntimeException(error); }
                service.deleteAccountScores(owner.getId()); users.delete(loaded);
            }));
            assertTrue(snapshot.await(10,TimeUnit.SECONDS));
            TemporiCloudService.ScoreDto score;
            try { score=service.upload(owner.getId(),"interleaved-request",file,"Committed later",null); } finally { uploaded.countDown(); }
            deletion.get(10,TimeUnit.SECONDS);
            assertEquals(TemporiScore.State.DELETING,scores.findById(score.id()).orElseThrow().getState());
            assertFalse(users.existsById(owner.getId()));
        }
    }
}
