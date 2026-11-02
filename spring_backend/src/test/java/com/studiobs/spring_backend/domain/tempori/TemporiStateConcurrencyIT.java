package com.studiobs.spring_backend.domain.tempori;
import static org.junit.jupiter.api.Assertions.*;
import com.studiobs.spring_backend.domain.user.entity.User;
import com.studiobs.spring_backend.domain.user.repository.UserRepository;
import com.studiobs.spring_backend.support.AbstractIntegrationTest;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.ObjectMapper;
/** Real MySQL locking/SQL assertions; requires isolated Testcontainers, never production credentials. */
class TemporiStateConcurrencyIT extends AbstractIntegrationTest {
    @Autowired TemporiStateService service; @Autowired TemporiCloudService cloud; @Autowired UserRepository users;
    @Autowired TemporiScoreRepository scores; @Autowired TemporiStateMutationRepository mutations; @Autowired TemporiScoreStateRepository documents;
    @Autowired ObjectMapper json; @Autowired JdbcTemplate jdbc; @Autowired PlatformTransactionManager manager;
    private TemporiScore score() {
        var id=UUID.randomUUID().toString();var user=users.saveAndFlush(User.builder().email(id+"@example.test").nickname(id).password("test-only").build());
        var score=TemporiScore.reserve(user.getId(),"request-"+id,"fingerprint","Test",null,"score.xml","musicxml",3,"a".repeat(64),Instant.now());score.ready(Instant.now());return scores.saveAndFlush(score);
    }
    private TemporiStateService.Write write(long revision,String mutation) { return new TemporiStateService.Write(revision,mutation,1,json.readTree("{\"kind\":\"musicxml\",\"measureIndex\":0,\"progress\":0}")); }
    @Test void concurrentFirstCreationAndUpdatePermitExactlyOneRevisionWinner() throws Exception {
        var score=score();var owner=UUID.fromString(score.getOwnerId());
        for(long revision=0;revision<2;revision++) {
            final long base=revision;var start=new CountDownLatch(1);
            try(var executor=Executors.newFixedThreadPool(2)) {
                var tasks=new ArrayList<Future<Boolean>>();
                for(int i=0;i<2;i++) tasks.add(executor.submit(()->{start.await();try {service.put(owner,score.getId(),"position",write(base,UUID.randomUUID().toString()));return true;}catch(TemporiStateService.StateConflict conflict){return false;}}));
                start.countDown();int winners=0;for(var task:tasks) if(task.get(15,TimeUnit.SECONDS)) winners++;
                assertEquals(1,winners);assertEquals(base+1,service.get(owner,score.getId(),"position").revision());
            }
        }
    }
    @Test void bulkDeletionAndLatePutCannotResurrectState() {
        var score=score();var owner=UUID.fromString(score.getOwnerId());service.put(owner,score.getId(),"position",write(0,"before-delete"));cloud.delete(owner,score.getId());
        assertTrue(documents.findByScoreIdOrderByDocumentKey(score.getId()).isEmpty());assertTrue(mutations.findByScoreIdAndMutationId(score.getId(),"before-delete").isEmpty());
        assertThrows(com.studiobs.spring_backend.global.exception.BusinessException.class,()->service.put(owner,score.getId(),"position",write(1,"after-delete")));
    }
    @Test void nativeRetentionKeepsOnly1000AndExpiredRetryCannotOverwrite() {
        var score=score();var owner=UUID.fromString(score.getOwnerId());service.put(owner,score.getId(),"position",write(0,"expired-request"));
        for(int i=0;i<1001;i++) jdbc.update("INSERT INTO tempori_state_mutations (id,score_id,mutation_id,request_hash,revision,updated_at) VALUES (?,?,?,?,?,?)",UUID.randomUUID().toString(),score.getId(),"synthetic-"+i,"a".repeat(64),1,java.sql.Timestamp.from(Instant.now().plusSeconds(i+1)));
        new TransactionTemplate(manager).executeWithoutResult(status->mutations.retainRecent(score.getId()));
        assertEquals(1000,jdbc.queryForObject("SELECT COUNT(*) FROM tempori_state_mutations WHERE score_id=?",Integer.class,score.getId()));
        assertThrows(TemporiStateService.StateConflict.class,()->service.put(owner,score.getId(),"position",write(0,"expired-request")));
        assertEquals(1,service.get(owner,score.getId(),"position").revision());
    }
}
