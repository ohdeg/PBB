package com.studiobs.spring_backend.domain.tempori;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import java.time.Instant;
import java.util.*;
import org.junit.jupiter.api.*;
import tools.jackson.databind.ObjectMapper;
import com.studiobs.spring_backend.domain.user.repository.UserRepository;
import com.studiobs.spring_backend.domain.user.entity.User;
import com.studiobs.spring_backend.global.exception.BusinessException;
class TemporiStateServiceTest {
    final UUID owner=UUID.randomUUID(); final ObjectMapper json=new ObjectMapper();
    TemporiScore score; TemporiScoreRepository scores; TemporiScoreStateRepository states; TemporiStateMutationRepository mutations; TemporiStateService service;
    Map<String,TemporiScoreState> docs; Map<String,TemporiStateMutation> requests;
    @BeforeEach void setup() {
        scores=mock(TemporiScoreRepository.class); states=mock(TemporiScoreStateRepository.class); mutations=mock(TemporiStateMutationRepository.class);
        var users=mock(UserRepository.class); when(users.lockById(owner)).thenReturn(Optional.of(mock(User.class)));
        score=TemporiScore.reserve(owner,"request-123","x","Title",null,"score.xml","musicxml",3,"a".repeat(64),Instant.now()); score.ready(Instant.now());
        when(scores.lockById(score.getId())).thenReturn(Optional.of(score)); docs=new HashMap<>(); requests=new HashMap<>();
        when(states.findByScoreIdAndDocumentKey(anyString(),anyString())).thenAnswer(c->Optional.ofNullable(docs.get(c.getArgument(1))));
        when(states.findByScoreIdOrderByDocumentKey(anyString())).thenAnswer(c->new ArrayList<>(docs.values()));
        when(states.saveAndFlush(any())).thenAnswer(c->{TemporiScoreState d=c.getArgument(0);docs.put(d.getDocumentKey(),d);return d;});
        when(mutations.findByScoreIdAndMutationId(anyString(),anyString())).thenAnswer(c->Optional.ofNullable(requests.get(c.getArgument(1))));
        when(mutations.save(any())).thenAnswer(c->{TemporiStateMutation m=c.getArgument(0);requests.put(m.getMutationId(),m);return m;});
        service=new TemporiStateService(scores,states,mutations,users,json);
    }
    TemporiStateService.Write write(long revision,String id,int bpm) { return new TemporiStateService.Write(revision,id,1,json.readTree("{\"bpm\":"+bpm+",\"tempoChanges\":[],\"startMeasure\":1,\"endMeasure\":2,\"isRepeatMode\":false}")); }
    @Test void casAndIdempotentReplayDoNotOverwriteNewerState() {
        var first=service.put(owner,score.getId(),"practice",write(0,"mutation-1",120)); assertEquals(1,first.revision());
        service.put(owner,score.getId(),"practice",write(1,"mutation-2",140));
        assertEquals(1,service.put(owner,score.getId(),"practice",write(0,"mutation-1",120)).revision());
        assertEquals(140,service.get(owner,score.getId(),"practice").payload().get("bpm").asInt());
        assertEquals(409,assertThrows(BusinessException.class,()->service.put(owner,score.getId(),"practice",write(0,"mutation-1",121))).getStatus().value());
        var conflict=assertThrows(TemporiStateService.StateConflict.class,()->service.put(owner,score.getId(),"practice",write(0,"mutation-3",100)));
        assertEquals(2,conflict.latest().revision());
    }
    @Test void deletedAndOtherOwnerScoresCannotReadOrWrite() {
        assertThrows(BusinessException.class,()->service.get(UUID.randomUUID(),score.getId(),"practice"));
        score.requestDelete(Instant.now()); assertThrows(BusinessException.class,()->service.put(owner,score.getId(),"practice",write(0,"mutation-1",120)));
    }
    @Test void validationRejectsInvalidSchemaKeysAndNumbers() {
        assertThrows(BusinessException.class,()->service.put(owner,score.getId(),"practice",write(0,"mutation-1",999)));
        assertThrows(BusinessException.class,()->service.get(owner,score.getId(),"../private"));
        assertThrows(BusinessException.class,()->service.put(owner,score.getId(),"practice",new TemporiStateService.Write(0,"mutation-1",99,write(0,"x",120).payload())));
    }

    @Test void documentAndScoreQuotasRejectWithoutMutatingData() {
        var body=write(0,"oversized-1",120).payload().deepCopy(); ((tools.jackson.databind.node.ObjectNode)body).put("padding","x".repeat(65536));
        assertEquals(413,assertThrows(BusinessException.class,()->service.put(owner,score.getId(),"practice",new TemporiStateService.Write(0,"oversized-1",1,body))).getStatus().value());
        var huge=TemporiScoreState.create(score.getId(),owner.toString(),"position");huge.replace(1,"{}",TemporiStateService.SCORE_LIMIT,Instant.now());docs.put("position",huge);
        assertEquals(413,assertThrows(BusinessException.class,()->service.put(owner,score.getId(),"practice",write(0,"over-score-1",120))).getStatus().value());assertFalse(docs.containsKey("practice"));
    }
    @Test void validWritePrunesReceiptsAndInvalidCoordinatesAreRejected() {
        service.put(owner,score.getId(),"practice",write(0,"valid-write-1",120));verify(mutations).retainRecent(score.getId());
        var payload=json.readTree("{\"kind\":\"pdf\",\"pageIndex\":-1,\"y\":0}");
        assertThrows(BusinessException.class,()->service.put(owner,score.getId(),"position",new TemporiStateService.Write(0,"invalid-position",1,payload)));
    }
    @Test void pdfMetronomeRoundTripsWithoutChangingOtherPracticeFields() {
        var body=(tools.jackson.databind.node.ObjectNode)write(0,"pdf-meter-1",120).payload().deepCopy();
        body.set("pdfMetronome",json.readTree("{\"beatsPerMeasure\":3,\"beatType\":8,\"beatStrengths\":[\"strong\",\"silent\",\"weak\"]}"));
        var result=service.put(owner,score.getId(),"practice",new TemporiStateService.Write(0,"pdf-meter-1",1,body));
        assertEquals(body,result.payload()); assertEquals(body,service.get(owner,score.getId(),"practice").payload());
    }
    @Test void pdfMetronomeValidationRejectsPartialInvalidAndWrongLengthSettings() {
        for(var raw:List.of("null","{}","{\"beatsPerMeasure\":0,\"beatType\":4,\"beatStrengths\":[]}","{\"beatsPerMeasure\":1.5,\"beatType\":4,\"beatStrengths\":[\"strong\"]}","{\"beatsPerMeasure\":1,\"beatType\":3,\"beatStrengths\":[\"strong\"]}","{\"beatsPerMeasure\":2,\"beatType\":4,\"beatStrengths\":[\"strong\"]}","{\"beatsPerMeasure\":1,\"beatType\":4,\"beatStrengths\":[\"loud\"]}")) {
            var body=(tools.jackson.databind.node.ObjectNode)write(0,"pdf-invalid-1",120).payload().deepCopy();body.set("pdfMetronome",json.readTree(raw));
            assertThrows(BusinessException.class,()->TemporiStateService.validate("practice",body,"a".repeat(64)),raw);
        }
    }
    @Test void pdfMetronomeAllowsBoundaryMetersAndAllSupportedBeatUnits() {
        for(var denominator:List.of(1,2,4,8,16)) for(var count:List.of(1,16)) {
            var body=(tools.jackson.databind.node.ObjectNode)write(0,"pdf-boundary-1",120).payload().deepCopy();
            var meter=json.createObjectNode();meter.put("beatsPerMeasure",count);meter.put("beatType",denominator);
            var strengths=json.createArrayNode();for(int i=0;i<count;i++)strengths.add(List.of("strong","medium","weak","silent").get(i%4));meter.set("beatStrengths",strengths);body.set("pdfMetronome",meter);
            assertDoesNotThrow(()->TemporiStateService.validate("practice",body,"a".repeat(64)));
            meter.put("beatsPerMeasure",17);assertThrows(BusinessException.class,()->TemporiStateService.validate("practice",body,"a".repeat(64)));
        }
    }
}
