package com.studiobs.spring_backend.domain.tempori;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;

/** Persisted reservation, idempotency record and cleanup job. Deliberately no cascading user FK. */
@Entity @Table(name="tempori_scores", uniqueConstraints=@UniqueConstraint(columnNames={"owner_id", "idempotency_key"}))
@Getter @NoArgsConstructor
public class TemporiScore {
    public enum State { UPLOADING, READY, FAILED, DELETING, DELETED }
    @Id @Column(length=36) private String id;
    @Column(name="owner_id", length=36, nullable=false) private String ownerId;
    @Column(name="idempotency_key", length=100, nullable=false) private String idempotencyKey;
    @Column(length=64, nullable=false) private String fingerprint;
    @Column(length=200, nullable=false) private String title;
    @Column(length=200) private String artist;
    @Column(name="file_name", length=255, nullable=false) private String fileName;
    @Column(length=16, nullable=false) private String format;
    @Column(nullable=false) private long sizeBytes;
    @Column(length=64, nullable=false) private String sha256;
    @Column(name="object_key", length=200, nullable=false) private String objectKey;
    @Enumerated(EnumType.STRING) @Column(length=16, nullable=false) private State state;
    @Column(nullable=false) private Instant createdAt;
    @Column(nullable=false) private Instant updatedAt;
    private Instant leaseUntil;
    private Instant cleanupAfter;
    @Column(length=36) private String uploadAttempt;
    @Version private long version;
    public static TemporiScore reserve(UUID owner, String key, String fingerprint, String title, String artist, String fileName, String format, long size, String hash, Instant now) {
        var row = new TemporiScore(); row.id = UUID.randomUUID().toString(); row.ownerId = owner.toString();
        row.idempotencyKey=key; row.fingerprint=fingerprint; row.title=title; row.artist=artist; row.fileName=fileName;
        row.format=format; row.sizeBytes=size; row.sha256=hash; row.objectKey="scores/"+UUID.randomUUID();
        row.createdAt=now; row.retry(now); return row;
    }
    public void retry(Instant now) { state=State.UPLOADING; uploadAttempt=UUID.randomUUID().toString(); updatedAt=now; leaseUntil=now.plusSeconds(600); }
    public boolean ready(Instant now) { if(state!=State.UPLOADING) return false; state=State.READY; leaseUntil=null; updatedAt=now; return true; }
    public void failed(Instant now) { if(state==State.UPLOADING) { state=State.FAILED; updatedAt=now; } }
    public void requestDelete(Instant now) { if(state!=State.DELETED) { state=State.DELETING; updatedAt=now; cleanupAfter=leaseUntil!=null && leaseUntil.isAfter(now) ? leaseUntil : now; } }
    public boolean canDelete(Instant now) { return state==State.DELETING && (leaseUntil==null || !leaseUntil.isAfter(now)); }
    public void deferCleanup(Instant now) { cleanupAfter=now.plusSeconds(300); }
    public void deleted(Instant now) { state=State.DELETED; updatedAt=now; leaseUntil=null; }
}
