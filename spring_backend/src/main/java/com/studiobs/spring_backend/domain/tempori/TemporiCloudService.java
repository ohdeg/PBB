package com.studiobs.spring_backend.domain.tempori;

import com.studiobs.spring_backend.domain.user.repository.UserRepository;
import com.studiobs.spring_backend.global.exception.BusinessException;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.multipart.MultipartFile;

@Service
public class TemporiCloudService {
    private final TemporiScoreRepository scores;
    private final TemporiScoreStateRepository states;
    private final TemporiStateMutationRepository mutations;
    private final UserRepository users;
    private final TemporiPrivateStorage storage;
    private final TemporiFileValidator validator;
    private final TransactionTemplate tx;
    private final long maxFileBytes,maxUserBytes;
    private final int maxUserFiles;
    public TemporiCloudService(TemporiScoreRepository scores,TemporiScoreStateRepository states,TemporiStateMutationRepository mutations,UserRepository users,TemporiPrivateStorage storage,TemporiFileValidator validator,PlatformTransactionManager manager,
        @Value("${tempori.max-file-bytes:26214400}") long maxFileBytes,@Value("${tempori.max-user-bytes:524288000}") long maxUserBytes,@Value("${tempori.max-user-files:200}") int maxUserFiles) {
        this.scores=scores;this.states=states;this.mutations=mutations;this.users=users;this.storage=storage;this.validator=validator;this.tx=new TransactionTemplate(manager);
        this.maxFileBytes=maxFileBytes;this.maxUserBytes=maxUserBytes;this.maxUserFiles=maxUserFiles;
    }
    public record ScoreDto(String id,String title,String artist,String fileName,String format,long sizeBytes,String sha256,Instant createdAt,long version) {
        static ScoreDto from(TemporiScore row) { return new ScoreDto(row.getId(),row.getTitle(),row.getArtist(),row.getFileName(),row.getFormat(),row.getSizeBytes(),row.getSha256(),row.getCreatedAt(),row.getVersion()); }
    }
    public record ScoreList(List<ScoreDto> items,String nextCursor) {}
    private static String fingerprintField(String value) { return value==null ? "-1:" : value.length()+":"+value; }
    private static BusinessException missing() { return new BusinessException(HttpStatus.NOT_FOUND,"악보를 찾을 수 없습니다."); }
    private static BusinessException conflict(String message) { return new BusinessException(HttpStatus.CONFLICT,message); }
    public ScoreDto upload(UUID owner,String key,MultipartFile file,String title,String artist) {
        storage.requireAvailable();
        if(key==null || !key.matches("[A-Za-z0-9_-]{8,100}")) throw TemporiFileValidator.invalid("유효한 Idempotency-Key가 필요합니다.");
        String cleanTitle=title==null ? "" : title.trim(); String cleanArtist=artist==null || artist.isBlank() ? null : artist.trim();
        String fileName=Optional.ofNullable(file.getOriginalFilename()).orElse("score").replace('\\','/'); fileName=fileName.substring(fileName.lastIndexOf('/')+1);
        if(cleanTitle.isEmpty() || cleanTitle.length()>200 || (cleanArtist!=null && cleanArtist.length()>200) || fileName.length()>255) throw TemporiFileValidator.invalid("제목 또는 파일명이 너무 깁니다.");
        var data=validator.validate(file,maxFileBytes); final String safeName=fileName;
        String fingerprint=TemporiFileValidator.hash((fingerprintField(data.sha256())+fingerprintField(cleanTitle)+fingerprintField(cleanArtist)+fingerprintField(safeName)).getBytes(StandardCharsets.UTF_8));
        TemporiScore row=tx.execute(status -> {
            users.lockById(owner).orElseThrow(TemporiCloudService::missing);
            var existing=scores.findByOwnerIdAndIdempotencyKey(owner.toString(),key);
            if(existing.isPresent()) {
                var found=scores.lockById(existing.get().getId()).orElseThrow(TemporiCloudService::missing);
                if(!fingerprint.equals(found.getFingerprint())) throw conflict("같은 업로드 키에 다른 원본 또는 정보가 있습니다.");
                if(found.getState()==TemporiScore.State.READY) return found;
                if(found.getState()==TemporiScore.State.DELETING || found.getState()==TemporiScore.State.DELETED) throw conflict("삭제한 업로드입니다. 새로 가져와 주세요.");
                if(found.getLeaseUntil()!=null && found.getLeaseUntil().isAfter(Instant.now())) throw conflict("저장 확인 중입니다. 잠시 후 같은 요청으로 재시도해 주세요.");
                found.retry(Instant.now()); return scores.saveAndFlush(found);
            }
            var reserved=scores.findByOwnerIdOrderByCreatedAtDesc(owner.toString()).stream().filter(s -> s.getState()!=TemporiScore.State.DELETED).toList();
            if(reserved.size()>=maxUserFiles || reserved.stream().mapToLong(TemporiScore::getSizeBytes).sum()+data.bytes().length>maxUserBytes) throw new BusinessException(HttpStatus.PAYLOAD_TOO_LARGE,"계정 보관함 용량 또는 파일 개수 제한을 초과했습니다.");
            return scores.saveAndFlush(TemporiScore.reserve(owner,key,fingerprint,cleanTitle,cleanArtist,safeName,data.format(),data.bytes().length,data.sha256(),Instant.now()));
        });
        if(row.getState()==TemporiScore.State.READY) return ScoreDto.from(row);
        // Capture by value: a reused persistence-context entity may be refreshed by a later lock.
        final String uploadAttempt=row.getUploadAttempt();
        try {
            storage.put(row.getObjectKey(),data.bytes(),data.sha256());
            return tx.execute(status -> {
                // Same lock order as reservation and account deletion. Never resurrect a deleted account.
                if(users.lockById(owner).isEmpty()) throw missing();
                var current=scores.lockById(row.getId()).orElseThrow(TemporiCloudService::missing);
                if(!uploadAttempt.equals(current.getUploadAttempt()) || !current.ready(Instant.now())) throw conflict("업로드 중 삭제된 악보입니다.");
                return ScoreDto.from(scores.saveAndFlush(current));
            });
        } catch(RuntimeException failure) {
            tx.executeWithoutResult(status -> scores.lockById(row.getId()).ifPresent(current -> { if(uploadAttempt.equals(current.getUploadAttempt())) current.failed(Instant.now()); }));
            if(failure instanceof BusinessException business) throw business;
            throw new BusinessException(HttpStatus.BAD_GATEWAY,"TEMPORI_UPLOAD_FAILED","서버 저장을 확인하지 못했습니다. 원본을 보관하고 재시도해 주세요.");
        }
    }
    public ScoreList list(UUID owner,String cursor) {
        var ready=scores.findByOwnerIdOrderByCreatedAtDesc(owner.toString()).stream().filter(s -> s.getState()==TemporiScore.State.READY).toList();
        int start=0;
        if(cursor!=null && !cursor.isBlank()) { while(start<ready.size() && !ready.get(start).getId().equals(cursor)) start++; if(start<ready.size()) start++; }
        var page=ready.subList(start,Math.min(start+50,ready.size()));
        return new ScoreList(page.stream().map(ScoreDto::from).toList(),start+50<ready.size() ? page.getLast().getId():null);
    }
    private TemporiScore ownedReady(UUID owner,String id) {
        var row=scores.findById(id).orElseThrow(TemporiCloudService::missing);
        if(!row.getOwnerId().equals(owner.toString()) || row.getState()!=TemporiScore.State.READY) throw missing(); return row;
    }
    public ScoreDto detail(UUID owner,String id) { return ScoreDto.from(ownedReady(owner,id)); }
    public TemporiPrivateStorage.Download download(UUID owner,String id) {
        return tx.execute(status -> {
            users.lockById(owner).orElseThrow(TemporiCloudService::missing);
            var row=scores.lockById(id).orElseThrow(TemporiCloudService::missing);
            if(!row.getOwnerId().equals(owner.toString()) || row.getState()!=TemporiScore.State.READY) throw missing();
            return storage.download(row.getObjectKey());
        });
    }
    public void delete(UUID owner,String id) {
       
        tx.executeWithoutResult(status -> {
            users.lockById(owner).orElseThrow(TemporiCloudService::missing);
            var row=scores.lockById(id).orElseThrow(TemporiCloudService::missing);
            if(!row.getOwnerId().equals(owner.toString())) throw missing(); row.requestDelete(Instant.now()); deleteState(row.getId());
        });
    }
    /** Joins account-deletion transaction; the user lock excludes concurrent reservations. */
    @org.springframework.transaction.annotation.Transactional
    public void deleteAccountScores(UUID owner) {
        users.lockById(owner).orElseThrow(TemporiCloudService::missing);
        for(var row:scores.lockAllByOwner(owner.toString())) { row.requestDelete(Instant.now()); deleteState(row.getId()); }
    }
    private void deleteState(String id) { mutations.deleteByScoreId(id); states.deleteByScoreId(id); }
    @Scheduled(fixedDelayString="${tempori.cleanup-interval-ms:60000}")
    public void reconcile() {
        Instant cutoff=Instant.now().minusSeconds(86400);
        for(var candidate:scores.cleanupCandidates(cutoff,Instant.now(),TemporiScore.State.DELETING,List.of(TemporiScore.State.UPLOADING,TemporiScore.State.FAILED),PageRequest.of(0,100))) {
            try {
                tx.executeWithoutResult(status -> scores.lockById(candidate.getId()).ifPresent(row -> {
                    Instant now=Instant.now();
                    if((row.getState()==TemporiScore.State.UPLOADING || row.getState()==TemporiScore.State.FAILED) && row.getUpdatedAt().isBefore(cutoff) && !row.getLeaseUntil().isAfter(now)) row.requestDelete(now);
                    if(row.canDelete(now)) { try { storage.delete(row.getObjectKey()); row.deleted(now); } catch(RuntimeException failure) { row.deferCleanup(now); } }
                }));
            } catch(RuntimeException failure) { /* Durable state remains queued; no object URL or credentials are logged. */ }
        }
    }
}
