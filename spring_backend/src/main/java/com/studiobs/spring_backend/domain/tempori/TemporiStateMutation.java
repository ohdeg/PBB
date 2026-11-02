package com.studiobs.spring_backend.domain.tempori;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import java.time.Instant;
import java.util.UUID;
@Entity @Table(name="tempori_state_mutations",uniqueConstraints=@UniqueConstraint(columnNames={"score_id","mutation_id"}))
@Getter @NoArgsConstructor
public class TemporiStateMutation {
    @Id @Column(length=36) private String id;
    @Column(name="score_id",length=36,nullable=false) private String scoreId;
    @Column(name="mutation_id",length=100,nullable=false) private String mutationId;
    @Column(length=64,nullable=false) private String requestHash;
    private long revision;
    private Instant updatedAt;
    static TemporiStateMutation create(String score,String mutation,String hash,long rev,Instant at) { var m=new TemporiStateMutation();m.id=UUID.randomUUID().toString();m.scoreId=score;m.mutationId=mutation;m.requestHash=hash;m.revision=rev;m.updatedAt=at;return m; }
}
