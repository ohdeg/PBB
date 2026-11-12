package com.studiobs.spring_backend.domain.dev.operations;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

@Service
public class OperationsLog {
    private static final ZoneId SEOUL = ZoneId.of("Asia/Seoul");
    private final JdbcTemplate db;
    public OperationsLog(JdbcTemplate db) { this.db = db; }

    static LocalDate day(Instant instant) { return instant.atZone(SEOUL).toLocalDate(); }

    public record ErrorGroup(String app, String operation, int status, long count, long lastMs, String requestId) {}
    public record Change(String id, long atMs, String actor, String action, String target, String before, String after) {}
    public record Today(LocalDate date, List<ErrorGroup> errors, List<Change> changes, String nextCursor) {}

    void error(String app, String operation, int status, Instant at, String ref) {
        db.update("""
                INSERT INTO ops_daily_error(day_kst,app,operation_key,http_status,hits,last_ms,last_ref)
                VALUES (?,?,?,?,1,?,?) ON DUPLICATE KEY UPDATE hits=hits+1,
                last_ref=IF(last_ms<=?, ?, last_ref),last_ms=GREATEST(last_ms,?)
                """, day(at), app, operation, status, at.toEpochMilli(), ref, at.toEpochMilli(), ref, at.toEpochMilli());
    }

    public void audit(UUID actor, String action, String target, String before, String after) {
        var at = Instant.now();
        db.update("""
                INSERT INTO ops_admin_change(day_kst,occurred_ms,actor_id,action_key,target_id,old_value,new_value)
                VALUES (?,?,?,?,?,?,?)
                """, day(at), at.toEpochMilli(), actor.toString(), action, target, before, after);
    }

    public Today today(Long beforeId) {
        var date = day(Instant.now());
        var errors = db.query("""
                SELECT app,operation_key,http_status,hits,last_ms,last_ref FROM ops_daily_error WHERE day_kst=?
                ORDER BY hits DESC,last_ms DESC,app,operation_key,http_status
                """, (r,n) -> new ErrorGroup(r.getString(1),r.getString(2),r.getInt(3),r.getLong(4),r.getLong(5),r.getString(6)), date);
        var changes = db.query("""
                SELECT id,occurred_ms,actor_id,action_key,target_id,old_value,new_value FROM ops_admin_change
                WHERE day_kst=? AND id<? ORDER BY id DESC LIMIT 31
                """, (r,n) -> new Change(r.getString(1),r.getLong(2),r.getString(3),r.getString(4),
                        r.getString(5),r.getString(6),r.getString(7)), date, beforeId == null ? Long.MAX_VALUE : beforeId);
        return new Today(date, errors, changes.stream().limit(30).toList(),
                changes.size() > 30 ? changes.get(29).id() : null);
    }

    @Scheduled(cron="0 25 3 * * *", zone="Asia/Seoul")
    public void expire() {
        var date = day(Instant.now());
        db.update("DELETE FROM ops_daily_error WHERE day_kst < ?", date.minusDays(29));
        db.update("DELETE FROM ops_admin_change WHERE day_kst < ?", date.minusDays(89));
    }
}
