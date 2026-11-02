package com.studiobs.spring_backend.domain.tempori;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import com.studiobs.spring_backend.domain.user.entity.User;
import com.studiobs.spring_backend.domain.user.repository.UserRepository;
import com.studiobs.spring_backend.global.exception.BusinessException;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.SimpleTransactionStatus;
class TemporiCloudServiceTest {
    final UUID owner=UUID.randomUUID(), stranger=UUID.randomUUID();
    TemporiScoreRepository scores; UserRepository users; TemporiPrivateStorage storage; PlatformTransactionManager manager; TemporiCloudService service;
    Map<String,TemporiScore> rows;
    final MockMultipartFile file=new MockMultipartFile("file","score.xml","application/xml","<score-partwise><part-list/></score-partwise>".getBytes(StandardCharsets.UTF_8));
    @BeforeEach void setup() {
        rows=new HashMap<>();scores=mock(TemporiScoreRepository.class);users=mock(UserRepository.class);storage=mock(TemporiPrivateStorage.class);manager=mock(PlatformTransactionManager.class);
        when(manager.getTransaction(any())).thenReturn(new SimpleTransactionStatus());
        when(users.lockById(owner)).thenReturn(Optional.of(mock(User.class))); when(users.lockById(stranger)).thenReturn(Optional.of(mock(User.class)));
        when(scores.saveAndFlush(any())).thenAnswer(call -> { TemporiScore row=call.getArgument(0); rows.put(row.getId(),row); return row; });
        when(scores.findByOwnerIdAndIdempotencyKey(anyString(),anyString())).thenAnswer(call -> rows.values().stream().filter(row -> row.getOwnerId().equals(call.getArgument(0)) && row.getIdempotencyKey().equals(call.getArgument(1))).findFirst());
        when(scores.lockById(anyString())).thenAnswer(call -> Optional.ofNullable(rows.get(call.getArgument(0))));
        when(scores.findById(anyString())).thenAnswer(call -> Optional.ofNullable(rows.get(call.getArgument(0))));
        when(scores.findByOwnerIdOrderByCreatedAtDesc(anyString())).thenAnswer(call -> rows.values().stream().filter(row -> row.getOwnerId().equals(call.getArgument(0))).toList());
        when(scores.lockAllByOwner(anyString())).thenAnswer(call -> rows.values().stream().filter(row -> row.getOwnerId().equals(call.getArgument(0))).toList());
        service=new TemporiCloudService(scores,mock(TemporiScoreStateRepository.class),mock(TemporiStateMutationRepository.class),users,storage,new TemporiFileValidator(),manager,26214400,524288000,200);
    }
    @Test void sameRequestRetryReturnsReadyIdWithoutWritingAgainAndDifferentRequestConflicts() {
        var first=service.upload(owner,"request-123",file,"Title",null);
        var retry=service.upload(owner,"request-123",file,"Title",null);
        assertEquals(first.id(),retry.id()); verify(storage,times(1)).put(anyString(),any(),anyString());
        assertEquals(409,assertThrows(BusinessException.class,()->service.upload(owner,"request-123",file,"Other title",null)).getStatus().value());
    }
    @Test void anotherOwnerCannotReadDownloadOrDeleteAndListIsIsolated() {
        var score=service.upload(owner,"request-123",file,"Title",null);
        assertEquals(404,assertThrows(BusinessException.class,()->service.detail(stranger,score.id())).getStatus().value());
        assertEquals(404,assertThrows(BusinessException.class,()->service.download(stranger,score.id())).getStatus().value());
        assertEquals(404,assertThrows(BusinessException.class,()->service.delete(stranger,score.id())).getStatus().value());
        assertTrue(service.list(stranger,null).items().isEmpty()); verify(storage,never()).download(anyString());
    }
    @Test void failedUploadStaysReservedAndCannotExceedQuota() {
        service=new TemporiCloudService(scores,mock(TemporiScoreStateRepository.class),mock(TemporiStateMutationRepository.class),users,storage,new TemporiFileValidator(),manager,26214400,524288000,1);
        doThrow(new RuntimeException("object failure")).when(storage).put(anyString(),any(),anyString());
        assertThrows(BusinessException.class,()->service.upload(owner,"request-123",file,"Title",null));
        assertEquals(TemporiScore.State.FAILED,rows.values().iterator().next().getState());
        assertTrue(service.list(owner,null).items().isEmpty());
        assertEquals(413,assertThrows(BusinessException.class,()->service.upload(owner,"request-456",file,"Title",null)).getStatus().value());
    }
    @Test void deletionDuringObjectWriteWinsOverLateCompletion() {
        doAnswer(call -> { service.deleteAccountScores(owner); return null; }).when(storage).put(anyString(),any(),anyString());
        assertThrows(BusinessException.class,()->service.upload(owner,"request-123",file,"Title",null));
        assertEquals(TemporiScore.State.DELETING,rows.values().iterator().next().getState());
        verify(scores).lockAllByOwner(owner.toString()); assertTrue(service.list(owner,null).items().isEmpty());
    }
    @Test void aSupersededUploadCannotCompleteOrFailTheNewAttemptEvenWithTheSameManagedEntity() {
        doAnswer(call -> { rows.values().iterator().next().retry(Instant.now()); return null; }).when(storage).put(anyString(),any(),anyString());
        assertThrows(BusinessException.class,()->service.upload(owner,"request-123",file,"Title",null));
        assertEquals(TemporiScore.State.UPLOADING,rows.values().iterator().next().getState());
    }
    @Test void missingArtistAndLiteralNullArtistAreDifferentIdempotentRequests() {
        service.upload(owner,"request-123",file,"Title",null);
        assertEquals(409,assertThrows(BusinessException.class,()->service.upload(owner,"request-123",file,"Title","null")).getStatus().value());
    }
    @Test void objectDeleteFailurePersistsRetryAndSuccessfulRetryMarksDeleted() {
        var score=service.upload(owner,"request-123",file,"Title",null); service.delete(owner,score.id());
        var row=rows.get(score.id()); when(scores.cleanupCandidates(any(),any(),any(),anyList(),any())).thenReturn(List.of(row));
        doThrow(new RuntimeException("unavailable")).doNothing().when(storage).delete(anyString());
        service.reconcile(); assertEquals(TemporiScore.State.DELETING,row.getState()); assertTrue(row.getCleanupAfter().isAfter(Instant.now()));
        service.reconcile(); assertEquals(TemporiScore.State.DELETED,row.getState());
    }
}
