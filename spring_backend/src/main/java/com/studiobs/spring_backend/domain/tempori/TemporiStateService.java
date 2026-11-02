package com.studiobs.spring_backend.domain.tempori;

import com.studiobs.spring_backend.domain.user.repository.UserRepository;
import com.studiobs.spring_backend.global.exception.BusinessException;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@Service @Transactional
public class TemporiStateService {
    public static final long ANNOTATION_LIMIT=2*1024*1024, SMALL_LIMIT=64*1024, SCORE_LIMIT=20*1024*1024;
    private final TemporiScoreRepository scores; private final TemporiScoreStateRepository states; private final TemporiStateMutationRepository mutations; private final UserRepository users; private final ObjectMapper json;
    public TemporiStateService(TemporiScoreRepository scores,TemporiScoreStateRepository states,TemporiStateMutationRepository mutations,UserRepository users,ObjectMapper json) { this.scores=scores;this.states=states;this.mutations=mutations;this.users=users;this.json=json; }
    public record Write(long baseRevision,String mutationId,int schemaVersion,JsonNode payload) {}
    public record Document(long revision,Instant updatedAt,int schemaVersion,JsonNode payload) {}
    public record Summary(String documentKey,long revision,int schemaVersion,Instant updatedAt) {}
    public record Listing(List<Summary> items,String nextCursor) {}
    public static class StateConflict extends RuntimeException {
        private final Document latest;
        StateConflict(Document latest) { super("다른 기기에서 변경한 내용이 있습니다.");this.latest=latest; }
        public Document latest() { return latest; }
    }
    private static BusinessException invalid() { return new BusinessException(HttpStatus.BAD_REQUEST,"유효하지 않은 연습 상태입니다."); }
    private static BusinessException missing() { return new BusinessException(HttpStatus.NOT_FOUND,"악보를 찾을 수 없습니다."); }
    private static BusinessException tooLarge() { return new BusinessException(HttpStatus.PAYLOAD_TOO_LARGE,"동기화 용량을 초과했습니다. 이 기기의 내용은 유지됩니다."); }
    static void key(String key) { if(key==null || !key.matches("practice|position|annotations:(pages|wrapped|horizontal):[a-zA-Z0-9_-]{1,160}")) throw invalid(); }
    private TemporiScore owned(UUID owner,String id) {
        // Same lock order as score/account deletion. Includes reads so deletion cannot expose stale state.
        users.lockById(owner).orElseThrow(TemporiStateService::missing);
        var score=scores.lockById(id).orElseThrow(TemporiStateService::missing);
        if(!score.getOwnerId().equals(owner.toString()) || score.getState()!=TemporiScore.State.READY) throw missing(); return score;
    }
    private Document dto(TemporiScoreState d) { return new Document(d.getRevision(),d.getUpdatedAt(),d.getSchemaVersion(),json.readTree(d.getPayload())); }
    public Listing list(UUID owner,String id,String cursor,String documentKey) {
        owned(owner,id); if(documentKey!=null) key(documentKey); if(cursor!=null) key(cursor);
        var matching=states.findByScoreIdOrderByDocumentKey(id).stream().filter(d->(documentKey==null || d.getDocumentKey().equals(documentKey)) && (cursor==null || d.getDocumentKey().compareTo(cursor)>0)).toList();
        var page=matching.stream().limit(50).map(d->new Summary(d.getDocumentKey(),d.getRevision(),d.getSchemaVersion(),d.getUpdatedAt())).toList();
        return new Listing(page,matching.size()>50 ? page.getLast().documentKey() : null);
    }
    public Document get(UUID owner,String id,String documentKey) { key(documentKey);owned(owner,id);return states.findByScoreIdAndDocumentKey(id,documentKey).map(this::dto).orElse(new Document(0,null,1,null)); }
    public Document put(UUID owner,String id,String documentKey,Write request) {
        key(documentKey); var score=owned(owner,id);
        if(request==null || request.baseRevision()<0 || request.schemaVersion()!=1 || request.mutationId()==null || !request.mutationId().matches("[a-zA-Z0-9_-]{8,100}")) throw invalid();
        validate(documentKey,request.payload(),score.getSha256());
        String payload=json.writeValueAsString(request.payload()); long bytes=payload.getBytes(StandardCharsets.UTF_8).length;
        if(bytes>(documentKey.startsWith("annotations:") ? ANNOTATION_LIMIT : SMALL_LIMIT)) throw tooLarge();
        String hash=TemporiFileValidator.hash((documentKey+"\n"+request.baseRevision()+"\n"+request.schemaVersion()+"\n"+payload).getBytes(StandardCharsets.UTF_8));
        var prior=mutations.findByScoreIdAndMutationId(id,request.mutationId());
        if(prior.isPresent()) {
            var m=prior.get(); if(!m.getRequestHash().equals(hash)) throw new BusinessException(HttpStatus.CONFLICT,"같은 변경 ID에 다른 내용이 있습니다.");
            // Echo the verified input; no duplicate 2 MiB snapshots in the mutation journal.
            return new Document(m.getRevision(),m.getUpdatedAt(),request.schemaVersion(),request.payload());
        }
        var current=states.findByScoreIdAndDocumentKey(id,documentKey).orElseGet(()->TemporiScoreState.create(id,owner.toString(),documentKey));
        if(current.getRevision()!=request.baseRevision()) throw new StateConflict(current.getRevision()==0 ? new Document(0,null,1,null) : dto(current));
        var documents=states.findByScoreIdOrderByDocumentKey(id);
        if((current.getRevision()==0 && documents.size()>=512) || documents.stream().mapToLong(TemporiScoreState::getPayloadBytes).sum()-current.getPayloadBytes()+bytes>SCORE_LIMIT) throw tooLarge();
        Instant now=Instant.now(); current.replace(request.schemaVersion(),payload,bytes,now);states.saveAndFlush(current);
        mutations.save(TemporiStateMutation.create(id,request.mutationId(),hash,current.getRevision(),now));mutations.flush();mutations.retainRecent(id);return dto(current);
    }
    static boolean number(JsonNode n,double min,double max) { return n!=null && n.isNumber() && Double.isFinite(n.asDouble()) && n.asDouble()>=min && n.asDouble()<=max; }
    static boolean integer(JsonNode n,int min,int max) { return number(n,min,max) && n.asDouble()==Math.floor(n.asDouble()); }
    static void validate(String key,JsonNode p,String hash) {
        if(p==null || !p.isObject()) throw invalid();
        if(key.equals("practice")) {
            if(!number(p.get("bpm"),20,300) || !integer(p.get("startMeasure"),1,1000000) || !integer(p.get("endMeasure"),1,1000000) || p.path("startMeasure").asInt()>p.path("endMeasure").asInt() || !p.path("isRepeatMode").isBoolean() || !p.path("tempoChanges").isArray() || p.path("tempoChanges").size()>2000) throw invalid();
            for(var t:p.path("tempoChanges")) if(!t.isObject() || !t.path("id").isTextual() || t.path("id").asText().length()>100 || !integer(t.get("startMeasure"),1,1000000) || !integer(t.get("endMeasure"),1,1000000) || t.path("startMeasure").asInt()>t.path("endMeasure").asInt() || !number(t.get("bpm"),20,300) || !integer(t.get("beatsPerMeasure"),1,16) || !integer(t.get("beatType"),1,16)) throw invalid();
        } else if(key.equals("position")) {
            if(p.path("kind").asText().equals("musicxml")) { if(!integer(p.get("measureIndex"),0,999999) || !number(p.get("progress"),0,1)) throw invalid(); }
            else if(p.path("kind").asText().equals("pdf")) { if(!integer(p.get("pageIndex"),0,999999) || !number(p.get("y"),0,1)) throw invalid(); }
            else throw invalid();
        } else {
            if(!p.path("originalHash").asText().equals(hash) || !p.path("layout").isTextual() || p.path("layout").asText().length()>1000 || !p.path("document").isObject()) throw invalid();
            var doc=p.path("document"); boolean pages=key.startsWith("annotations:pages:"),horizontal=key.startsWith("annotations:horizontal:");
            if(doc.path("version").asInt()!= (horizontal ? 2 : 1)) throw invalid();
            int[] counts={0,0};
            if(pages) { if(!doc.path("pages").isArray() || doc.path("pages").size()>10000) throw invalid();for(var page:doc.path("pages")) { if(!integer(page.get("pageIndex"),0,999999)) throw invalid();strokes(page.path("strokes"),true,false,counts); } }
            else strokes(doc.path("strokes"),false,horizontal,counts);
        }
    }
    private static void strokes(JsonNode list,boolean pages,boolean horizontal,int[] counts) {
        if(!list.isArray()) throw invalid();
        for(var s:list) {
            if(++counts[0]>10000 || !s.path("id").isTextual() || s.path("id").asText().length()>100 || !Set.of("pen","highlighter").contains(s.path("tool").asText()) || !s.path("color").asText().matches("#[0-9a-fA-F]{3,8}|[a-zA-Z]{1,20}|rgba?\\([0-9., %]+\\)")) throw invalid();
            if(!number(s.get(pages ? "widthPageRatio" : horizontal ? "widthStaffRatio" : "width"),0.000001,pages ? 1 : horizontal ? 10 : 100)) throw invalid();
            if(horizontal) { if(!s.path("segments").isArray()) throw invalid(); for(var segment:s.path("segments")) { if(!integer(segment.get("measureIndex"),0,999999)) throw invalid();points(segment.path("points"),-100,100,counts); } }
            else points(s.path("points"),0,1,counts);
        }
    }
    private static void points(JsonNode list,double min,double max,int[] counts) {
        if(!list.isArray() || list.size()<2 || (counts[1]+=list.size())>200000) throw invalid();
        for(var p:list) if(!number(p.get("x"),min,max) || !number(p.get("y"),min,max)) throw invalid();
    }
}
