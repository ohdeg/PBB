package com.studiobs.spring_backend.domain.dieta.service;

import com.studiobs.spring_backend.domain.dieta.dto.meal.DietaMealSchedule;
import com.studiobs.spring_backend.global.exception.BusinessException;
import java.time.*;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/** Mutations run inside the caller's profile-row lock. Instants are stored as UTC epoch ms. */
@Repository
@RequiredArgsConstructor
public class DietaAnalysisStore {
    public enum Stage { MAIN, SUPPLEMENT }
    enum Origin { MANUAL, SCHEDULED, LEGACY_AUTO }
    record Attempt(String state, String origin) {
        boolean spent() { return state.equals("SENT") || state.equals("FAILED") || state.equals("DONE"); }
    }
    record Due(UUID userId, Instant at) {}
    private final JdbcTemplate jdbc;

    public DietaMealSchedule schedule(UUID user) {
        return jdbc.query("SELECT local_time,zone_id,next_run_ms FROM dieta_meal_schedules WHERE user_id=?",
                (r,n) -> new DietaMealSchedule(true, r.getString(1), r.getString(2), Instant.ofEpochMilli(r.getLong(3))),
                user.toString()).stream().findFirst().orElseGet(DietaMealSchedule::disabled);
    }

    static Instant nextRun(Instant after, LocalTime time, ZoneId zone) {
        LocalDate date = after.atZone(zone).toLocalDate();
        for (;;) {
            var wall = date.atTime(time);
            var transition = zone.getRules().getTransition(wall);
            Instant at = transition != null && transition.isGap() ? transition.getInstant() : wall.atZone(zone).toInstant();
            if (at.isAfter(after)) return at;
            date = date.plusDays(1);
        }
    }

    void configure(UUID user, DietaMealSchedule input, Instant now) {
        if (!input.enabled()) {
            jdbc.update("DELETE FROM dieta_meal_schedules WHERE user_id=?", user.toString());
            return;
        }
        if (input.time() == null || !input.time().matches("([01][0-9]|2[0-3]):[0-5][0-9]")
                || !ZoneId.getAvailableZoneIds().contains(input.zone() == null ? "" : input.zone())) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "예약 시각과 시간대를 확인해 주세요.");
        }
        var at = nextRun(now, LocalTime.parse(input.time()), ZoneId.of(input.zone()));
        jdbc.update("""
                INSERT INTO dieta_meal_schedules(user_id,local_time,zone_id,next_run_ms) VALUES(?,?,?,?)
                ON DUPLICATE KEY UPDATE local_time=VALUES(local_time),zone_id=VALUES(zone_id),next_run_ms=VALUES(next_run_ms)
                """, user.toString(), input.time(), input.zone(), at.toEpochMilli());
    }

    List<Due> due(Instant now) {
        return jdbc.query("SELECT user_id,next_run_ms FROM dieta_meal_schedules WHERE next_run_ms<=? ORDER BY next_run_ms,user_id LIMIT 64",
                (r,n) -> new Due(UUID.fromString(r.getString(1)), Instant.ofEpochMilli(r.getLong(2))), now.toEpochMilli());
    }

    void advance(Due due, DietaMealSchedule schedule, Instant now) {
        Instant oldest = now.minus(Duration.ofHours(48));
        Instant after = due.at().isBefore(oldest) ? oldest : due.at();
        var next = nextRun(after, LocalTime.parse(schedule.time()), ZoneId.of(schedule.zone()));
        jdbc.update("UPDATE dieta_meal_schedules SET next_run_ms=? WHERE user_id=? AND next_run_ms=?",
                next.toEpochMilli(), due.userId().toString(), due.at().toEpochMilli());
    }

    Attempt attempt(UUID user, LocalDate day, Stage stage) {
        return jdbc.query("SELECT state,origin FROM dieta_meal_analysis_days WHERE user_id=? AND logged_on=? AND stage=?",
                (r,n) -> new Attempt(r.getString(1), r.getString(2)),user.toString(), day, stage.name())
                .stream().findFirst().orElse(null);
    }

    void reserve(UUID user, LocalDate day, Stage stage, Origin origin, UUID claim) {
        jdbc.update("""
                INSERT INTO dieta_meal_analysis_days(user_id,logged_on,stage,origin,state,claim_id) VALUES(?,?,?,?,'READY',?)
                ON DUPLICATE KEY UPDATE origin=VALUES(origin),claim_id=VALUES(claim_id),state='READY'
                """, user.toString(), day, stage.name(), origin.name(), claim.toString());
    }

    boolean transition(UUID user, LocalDate day, Stage stage, UUID claim, String from, String to) {
        return jdbc.update("""
                UPDATE dieta_meal_analysis_days SET state=?
                WHERE user_id=? AND logged_on=? AND stage=? AND claim_id=? AND state=?
                """, to, user.toString(), day, stage.name(), claim.toString(), from) == 1;
    }
}
