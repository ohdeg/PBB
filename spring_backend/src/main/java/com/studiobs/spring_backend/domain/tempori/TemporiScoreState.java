package com.studiobs.spring_backend.domain.tempori;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import java.time.Instant;
import java.util.UUID;
@Entity @Table(name="tempori_score_states",uniqueConstraints=@UniqueConstraint(columnNames={"score_id","document_key"}))
@Getter @NoArgsConstructor
public class TemporiScoreState {
    @Id @Column(length=36) private String id;
    @Column(name="score_id",length=36,nullable=false) private String scoreId;
    @Column(name="owner_id",length=36,nullable=false) private String ownerId;
    @Column(name="document_key",length=200,nullable=false) private String documentKey;
    private int schemaVersion;
    private long revision;
    @Column(columnDefinition="json",nullable=false) private String payload;
    private long payloadBytes;
    private Instant updatedAt;
    static TemporiScoreState create(String score,String owner,String key) { var d=new TemporiScoreState();d.id=UUID.randomUUID().toString();d.scoreId=score;d.ownerId=owner;d.documentKey=key;return d; }
    void replace(int schema,String body,long bytes,Instant now) { schemaVersion=schema;payload=body;payloadBytes=bytes;revision++;updatedAt=now; }
}
