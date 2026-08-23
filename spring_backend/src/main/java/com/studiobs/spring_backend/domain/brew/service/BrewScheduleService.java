package com.studiobs.spring_backend.domain.brew.service;

import com.studiobs.spring_backend.domain.brew.dto.CalendarOccurrenceResponse;
import com.studiobs.spring_backend.domain.brew.dto.CalendarResponse;
import com.studiobs.spring_backend.domain.brew.dto.AssignCoverRequest;
import com.studiobs.spring_backend.domain.brew.dto.CoverResponse;
import com.studiobs.spring_backend.domain.brew.dto.CreateCoverRequest;
import com.studiobs.spring_backend.domain.brew.dto.ReplaceSchedulesRequest;
import com.studiobs.spring_backend.domain.brew.dto.ScheduleReplaceMode;
import com.studiobs.spring_backend.domain.brew.dto.ScheduleResponse;
import com.studiobs.spring_backend.domain.brew.dto.ScheduleSlotRequest;
import com.studiobs.spring_backend.domain.brew.dto.StaffMemberResponse;
import com.studiobs.spring_backend.domain.brew.entity.BrewShiftCover;
import com.studiobs.spring_backend.domain.brew.entity.BrewStaffSchedule;
import com.studiobs.spring_backend.domain.brew.entity.BrewStaffScheduleOverride;
import com.studiobs.spring_backend.domain.brew.entity.BrewStore;
import com.studiobs.spring_backend.domain.brew.entity.BrewStoreSubscription;
import com.studiobs.spring_backend.domain.brew.repository.BrewShiftCoverRepository;
import com.studiobs.spring_backend.domain.brew.repository.BrewStaffScheduleOverrideRepository;
import com.studiobs.spring_backend.domain.brew.repository.BrewStaffScheduleRepository;
import com.studiobs.spring_backend.domain.brew.repository.BrewStoreRepository;
import com.studiobs.spring_backend.domain.brew.repository.BrewStoreSubscriptionRepository;
import com.studiobs.spring_backend.domain.brew.support.BrewEffectiveShifts;
import com.studiobs.spring_backend.domain.brew.support.BrewShiftTimes;
import com.studiobs.spring_backend.domain.user.entity.User;
import com.studiobs.spring_backend.domain.user.service.UserService;
import com.studiobs.spring_backend.global.exception.BusinessException;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class BrewScheduleService {

    private static final List<String> ACTIVE_COVER_STATUSES = List.of(
            BrewShiftCover.STATUS_PENDING_OWNER,
            BrewShiftCover.STATUS_PENDING_COVER,
            BrewShiftCover.STATUS_APPROVED
    );

    private final UserService userService;
    private final BrewStoreRepository storeRepository;
    private final BrewStoreSubscriptionRepository subscriptionRepository;
    private final BrewStaffScheduleRepository scheduleRepository;
    private final BrewStaffScheduleOverrideRepository overrideRepository;
    private final BrewShiftCoverRepository coverRepository;

    @Transactional(readOnly = true)
    public List<StaffMemberResponse> listStaff(String email, UUID storeId) {
        User user = requireUser(email);
        BrewStore store = requireStore(storeId);
        assertMember(store, user.getId());
        List<BrewStoreSubscription> subs =
                subscriptionRepository.findByStoreIdOrderByCreatedAtDesc(storeId);
        if (subs.isEmpty()) {
            return List.of();
        }
        Map<UUID, User> usersById = userService
                .findAllById(subs.stream().map(BrewStoreSubscription::getSubscriberUserId).toList())
                .stream()
                .collect(Collectors.toMap(User::getId, u -> u, (a, b) -> a));
        List<StaffMemberResponse> result = new ArrayList<>(subs.size());
        for (BrewStoreSubscription sub : subs) {
            User member = usersById.get(sub.getSubscriberUserId());
            if (member != null) {
                result.add(new StaffMemberResponse(member.getId(), member.getNickname()));
            }
        }
        return result;
    }

    @Transactional(readOnly = true)
    public List<ScheduleResponse> listSchedules(String email, UUID storeId) {
        User user = requireUser(email);
        BrewStore store = requireStore(storeId);
        assertMember(store, user.getId());
        boolean owner = store.getOwnerUserId().equals(user.getId());
        List<BrewStaffSchedule> schedules = owner
                ? scheduleRepository.findByStoreIdOrderByUserIdAscDayOfWeekAsc(storeId)
                : scheduleRepository.findByStoreIdAndUserIdOrderByDayOfWeekAsc(storeId, user.getId());
        LocalDate today = BrewShiftTimes.nowSeoul().toLocalDate();
        List<BrewStaffSchedule> asOfToday = BrewEffectiveShifts.weeklyAsOf(schedules, today);
        Map<UUID, String> nicknames = nicknameMap(asOfToday.stream()
                .map(BrewStaffSchedule::getUserId)
                .collect(Collectors.toSet()));
        return asOfToday.stream()
                .map(s -> ScheduleResponse.from(s, nicknames.getOrDefault(s.getUserId(), "")))
                .toList();
    }

    @Transactional
    public List<ScheduleResponse> replaceSchedules(
            String email,
            UUID storeId,
            UUID targetUserId,
            ReplaceSchedulesRequest request
    ) {
        User owner = requireUser(email);
        requireOwnedStore(storeId, owner.getId());
        requireSubscriber(storeId, targetUserId);

        Map<Integer, ScheduleSlotRequest> slotsByDay = new HashMap<>();
        for (ScheduleSlotRequest slot : request.slots()) {
            if (slotsByDay.put(slot.dayOfWeek(), slot) != null) {
                throw new BusinessException(HttpStatus.BAD_REQUEST, "같은 요일 슬롯이 중복됩니다.");
            }
            try {
                BrewShiftTimes.requireValidRange(slot.startTime(), slot.endTime());
            } catch (IllegalArgumentException ex) {
                throw new BusinessException(HttpStatus.BAD_REQUEST, ex.getMessage());
            }
        }

        LocalDate today = BrewShiftTimes.nowSeoul().toLocalDate();
        ScheduleReplaceMode mode = request.mode();
        if (mode == ScheduleReplaceMode.ONCE) {
            saveOnceOverride(storeId, targetUserId, requireApplyDate(request, today), slotsByDay);
        } else {
            LocalDate from = mode == ScheduleReplaceMode.FROM_TODAY
                    ? today
                    : requireApplyDate(request, today);
            saveWeeklyFrom(storeId, targetUserId, from, slotsByDay);
        }

        List<BrewStaffSchedule> asOfToday = BrewEffectiveShifts.weeklyAsOf(
                scheduleRepository.findByStoreIdAndUserIdOrderByDayOfWeekAsc(storeId, targetUserId),
                today);
        String nickname = nicknameOf(targetUserId);
        return asOfToday.stream()
                .sorted((a, b) -> Integer.compare(a.getDayOfWeek(), b.getDayOfWeek()))
                .map(s -> ScheduleResponse.from(s, nickname))
                .toList();
    }

    @Transactional(readOnly = true)
    public CalendarResponse getCalendar(String email, UUID storeId, LocalDate from, LocalDate to) {
        User user = requireUser(email);
        BrewStore store = requireStore(storeId);
        assertMember(store, user.getId());
        if (from == null || to == null || to.isBefore(from)) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "조회 기간이 올바르지 않습니다.");
        }
        if (from.plusDays(62).isBefore(to)) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "조회 기간은 최대 62일입니다.");
        }

        boolean owner = store.getOwnerUserId().equals(user.getId());
        List<BrewStaffSchedule> schedules = owner
                ? scheduleRepository.findByStoreIdOrderByUserIdAscDayOfWeekAsc(storeId)
                : scheduleRepository.findByStoreIdAndUserIdOrderByDayOfWeekAsc(storeId, user.getId());
        LocalDate overrideFrom = from.minusDays(1);
        List<BrewStaffScheduleOverride> overrides = owner
                ? overrideRepository.findByStoreIdAndWorkDateBetween(storeId, overrideFrom, to)
                : overrideRepository.findByStoreIdAndUserIdAndWorkDateBetween(
                        storeId, user.getId(), overrideFrom, to);

        LocalDate coverFrom = from.minusDays(1);
        List<BrewShiftCover> coversInRange =
                coverRepository.findByStoreIdAndWorkDateBetweenOrderByWorkDateAscStartTimeAsc(
                        storeId, coverFrom, to);

        if (!owner) {
            coversInRange = coversInRange.stream()
                    .filter(c -> user.getId().equals(c.getOriginalUserId())
                            || user.getId().equals(c.getCoverUserId())
                            || c.getRequestedByUserId().equals(user.getId()))
                    .toList();
        }

        Set<UUID> userIds = new HashSet<>();
        schedules.forEach(s -> userIds.add(s.getUserId()));
        overrides.forEach(o -> userIds.add(o.getUserId()));
        coversInRange.forEach(c -> {
            userIds.add(c.getOriginalUserId());
            userIds.add(c.getCoverUserId());
        });
        Map<UUID, String> nicknames = nicknameMap(userIds);

        LocalDate today = BrewShiftTimes.nowSeoul().toLocalDate();
        List<ScheduleResponse> scheduleResponses = BrewEffectiveShifts.weeklyAsOf(schedules, today)
                .stream()
                .map(s -> ScheduleResponse.from(s, nicknames.getOrDefault(s.getUserId(), "")))
                .toList();
        List<CoverResponse> coverResponses = coversInRange.stream()
                .filter(c -> overlapsRange(c.getWorkDate(), c.isOvernight(), from, to))
                .map(c -> CoverResponse.from(
                        c,
                        nicknames.getOrDefault(c.getOriginalUserId(), ""),
                        nicknames.getOrDefault(c.getCoverUserId(), "")))
                .toList();

        Map<String, BrewShiftCover> approvedCoverByOriginalDate = new HashMap<>();
        for (BrewShiftCover cover : coversInRange) {
            if (!BrewShiftCover.STATUS_APPROVED.equals(cover.getStatus())) {
                continue;
            }
            // 대체(COVER)만 원래 근무자를 COVERED_OUT 처리. EXTRA는 원 근무 유지.
            if (BrewShiftCover.KIND_COVER.equals(
                    cover.getShiftKind() == null ? BrewShiftCover.KIND_COVER : cover.getShiftKind())) {
                approvedCoverByOriginalDate.put(
                        cover.getOriginalUserId() + "|" + cover.getWorkDate(),
                        cover);
            }
        }

        Map<UUID, BrewStoreSubscription> subsByUser = subscriptionRepository
                .findByStoreIdOrderByCreatedAtDesc(storeId)
                .stream()
                .collect(Collectors.toMap(
                        BrewStoreSubscription::getSubscriberUserId,
                        s -> s,
                        (a, b) -> a
                ));

        Map<UUID, List<BrewStaffSchedule>> versionsByUser = schedules.stream()
                .collect(Collectors.groupingBy(BrewStaffSchedule::getUserId));
        Map<String, BrewStaffScheduleOverride> overrideByUserDate = new HashMap<>();
        for (BrewStaffScheduleOverride override : overrides) {
            overrideByUserDate.put(
                    BrewEffectiveShifts.overrideKey(override.getUserId(), override.getWorkDate()),
                    override);
        }
        Set<UUID> staffIds = new HashSet<>(versionsByUser.keySet());
        overrides.forEach(o -> staffIds.add(o.getUserId()));

        List<CalendarOccurrenceResponse> occurrences = new ArrayList<>();
        for (LocalDate date = from; !date.isAfter(to); date = date.plusDays(1)) {
            for (UUID staffId : staffIds) {
                BrewStoreSubscription sub = subsByUser.get(staffId);
                if (sub != null && !sub.isActiveOn(date)) {
                    continue;
                }
                BrewEffectiveShifts.Shift shift = BrewEffectiveShifts.resolve(
                        versionsByUser.getOrDefault(staffId, List.of()),
                        overrideByUserDate.get(BrewEffectiveShifts.overrideKey(staffId, date)),
                        date);
                if (shift == null) {
                    continue;
                }
                BrewShiftCover approved = approvedCoverByOriginalDate.get(staffId + "|" + date);
                if (approved != null) {
                    occurrences.add(new CalendarOccurrenceResponse(
                            date,
                            staffId,
                            nicknames.getOrDefault(staffId, ""),
                            shift.start(),
                            shift.end(),
                            shift.overnight(),
                            "COVERED_OUT",
                            approved.getId(),
                            approved.getCoverUserId(),
                            nicknames.getOrDefault(approved.getCoverUserId(), "")
                    ));
                } else {
                    occurrences.add(new CalendarOccurrenceResponse(
                            date,
                            staffId,
                            nicknames.getOrDefault(staffId, ""),
                            shift.start(),
                            shift.end(),
                            shift.overnight(),
                            "REGULAR",
                            null,
                            null,
                            null
                    ));
                }
            }
        }

        for (BrewShiftCover cover : coversInRange) {
            if (!BrewShiftCover.STATUS_APPROVED.equals(cover.getStatus())) {
                continue;
            }
            if (cover.getWorkDate().isBefore(from) || cover.getWorkDate().isAfter(to)) {
                continue;
            }
            if (owner
                    || user.getId().equals(cover.getCoverUserId())
                    || user.getId().equals(cover.getOriginalUserId())) {
                String kind = cover.getShiftKind() == null
                        ? BrewShiftCover.KIND_COVER
                        : cover.getShiftKind();
                String type = BrewShiftCover.KIND_EXTRA.equals(kind) ? "EXTRA" : "COVER";
                occurrences.add(new CalendarOccurrenceResponse(
                        cover.getWorkDate(),
                        cover.getCoverUserId(),
                        nicknames.getOrDefault(cover.getCoverUserId(), ""),
                        cover.getStartTime(),
                        cover.getEndTime(),
                        cover.isOvernight(),
                        type,
                        cover.getId(),
                        cover.getOriginalUserId(),
                        cover.getOriginalUserId() == null
                                ? null
                                : nicknames.getOrDefault(cover.getOriginalUserId(), "")
                ));
            }
        }

        occurrences.sort((a, b) -> {
            int cmp = a.date().compareTo(b.date());
            if (cmp != 0) {
                return cmp;
            }
            return a.startTime().compareTo(b.startTime());
        });

        return new CalendarResponse(from, to, scheduleResponses, coverResponses, occurrences);
    }

    private static boolean overlapsRange(
            LocalDate workDate,
            boolean overnight,
            LocalDate from,
            LocalDate to
    ) {
        if (!workDate.isBefore(from) && !workDate.isAfter(to)) {
            return true;
        }
        return overnight
                && !workDate.plusDays(1).isBefore(from)
                && !workDate.plusDays(1).isAfter(to);
    }

    @Transactional
    public CoverResponse createCover(String email, UUID storeId, CreateCoverRequest request) {
        User actor = requireUser(email);
        BrewStore store = requireStore(storeId);
        assertMember(store, actor.getId());

        try {
            BrewShiftTimes.requireValidRange(request.startTime(), request.endTime());
        } catch (IllegalArgumentException ex) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, ex.getMessage());
        }

        String shiftKind = normalizeShiftKind(request.shiftKind());
        boolean isExtra = BrewShiftCover.KIND_EXTRA.equals(shiftKind);
        boolean isOwner = store.getOwnerUserId().equals(actor.getId());

        UUID originalUserId;
        UUID coverUserId;
        String initiatorType;
        String status;

        if (isExtra) {
            if (request.originalUserId() != null) {
                throw new BusinessException(HttpStatus.BAD_REQUEST, "추가 근무에는 원래 근무자가 없습니다.");
            }
            originalUserId = null;
            if (isOwner) {
                if (request.coverUserId() == null) {
                    throw new BusinessException(HttpStatus.BAD_REQUEST, "추가 근무자를 선택해 주세요.");
                }
                validateCoverUser(
                        storeId,
                        null,
                        request.coverUserId(),
                        request.workDate(),
                        request.startTime(),
                        request.endTime()
                );
                coverUserId = request.coverUserId();
                initiatorType = BrewShiftCover.INITIATOR_OWNER;
                status = BrewShiftCover.STATUS_PENDING_COVER;
            } else {
                if (request.coverUserId() != null && !request.coverUserId().equals(actor.getId())) {
                    throw new BusinessException(HttpStatus.BAD_REQUEST, "직원 추가 근무는 본인만 신청할 수 있습니다.");
                }
                validateCoverUser(
                        storeId,
                        null,
                        actor.getId(),
                        request.workDate(),
                        request.startTime(),
                        request.endTime()
                );
                coverUserId = actor.getId();
                initiatorType = BrewShiftCover.INITIATOR_EMPLOYEE;
                status = BrewShiftCover.STATUS_PENDING_OWNER;
            }
        } else {
            if (request.originalUserId() == null) {
                throw new BusinessException(HttpStatus.BAD_REQUEST, "원래 근무자를 선택해 주세요.");
            }
            requireSubscriber(storeId, request.originalUserId());
            originalUserId = request.originalUserId();
            if (isOwner) {
                if (request.coverUserId() == null) {
                    throw new BusinessException(HttpStatus.BAD_REQUEST, "대타자를 선택해 주세요.");
                }
                validateCoverUser(
                        storeId,
                        originalUserId,
                        request.coverUserId(),
                        request.workDate(),
                        request.startTime(),
                        request.endTime()
                );
                coverUserId = request.coverUserId();
                initiatorType = BrewShiftCover.INITIATOR_OWNER;
                status = BrewShiftCover.STATUS_PENDING_COVER;
            } else {
                if (!actor.getId().equals(originalUserId)) {
                    throw new BusinessException(
                            HttpStatus.FORBIDDEN,
                            "직원은 본인 근무에 대해서만 신청할 수 있습니다."
                    );
                }
                if (request.coverUserId() != null) {
                    throw new BusinessException(HttpStatus.BAD_REQUEST, "직원 신청에서는 업주가 근무자를 지정합니다.");
                }
                coverUserId = null;
                initiatorType = BrewShiftCover.INITIATOR_EMPLOYEE;
                status = BrewShiftCover.STATUS_PENDING_OWNER;
            }
            assertNoActiveCoverConflict(storeId, originalUserId, request.workDate());
        }

        BrewShiftCover cover = coverRepository.save(BrewShiftCover.builder()
                .storeId(storeId)
                .originalUserId(originalUserId)
                .coverUserId(coverUserId)
                .workDate(request.workDate())
                .startTime(request.startTime())
                .endTime(request.endTime())
                .shiftKind(shiftKind)
                .initiatorType(initiatorType)
                .requestedByUserId(actor.getId())
                .status(status)
                .note(trimNote(request.note()))
                .build());

        return toCoverResponse(cover);
    }

    private String normalizeShiftKind(String raw) {
        if (raw == null || raw.isBlank()) {
            return BrewShiftCover.KIND_COVER;
        }
        String kind = raw.trim().toUpperCase();
        if (!BrewShiftCover.KIND_COVER.equals(kind) && !BrewShiftCover.KIND_EXTRA.equals(kind)) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "근무 종류가 올바르지 않습니다.");
        }
        return kind;
    }

    @Transactional
    public CoverResponse assignCover(String email, UUID coverId, AssignCoverRequest request) {
        User owner = requireUser(email);
        BrewShiftCover cover = requireCover(coverId);
        requireOwnedStore(cover.getStoreId(), owner.getId());
        if (!BrewShiftCover.STATUS_PENDING_OWNER.equals(cover.getStatus())) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "업주 대타자 지정 대기 상태가 아닙니다.");
        }
        if (BrewShiftCover.KIND_EXTRA.equals(
                cover.getShiftKind() == null ? BrewShiftCover.KIND_COVER : cover.getShiftKind())) {
            throw new BusinessException(
                    HttpStatus.BAD_REQUEST,
                    "추가 근무는 담당자 지정 대신 승인하세요."
            );
        }
        validateCoverUser(
                cover.getStoreId(),
                cover.getOriginalUserId(),
                request.coverUserId(),
                cover.getWorkDate(),
                cover.getStartTime(),
                cover.getEndTime()
        );
        cover.assignCoverUser(request.coverUserId());
        return toCoverResponse(coverRepository.save(cover));
    }

    @Transactional
    public CoverResponse acceptCover(String email, UUID coverId) {
        User actor = requireUser(email);
        BrewShiftCover cover = requireCover(coverId);
        BrewStore store = requireStore(cover.getStoreId());
        assertMember(store, actor.getId());
        boolean isOwner = store.getOwnerUserId().equals(actor.getId());
        String kind = cover.getShiftKind() == null ? BrewShiftCover.KIND_COVER : cover.getShiftKind();

        // 직원 추가 근무 신청: 업주가 PENDING_OWNER에서 바로 승인
        if (BrewShiftCover.KIND_EXTRA.equals(kind)
                && BrewShiftCover.STATUS_PENDING_OWNER.equals(cover.getStatus())) {
            if (!isOwner) {
                throw new BusinessException(HttpStatus.FORBIDDEN, "업주만 추가 근무를 승인할 수 있습니다.");
            }
            if (cover.getCoverUserId() == null) {
                throw new BusinessException(HttpStatus.BAD_REQUEST, "추가 근무자가 없습니다.");
            }
            cover.decide(BrewShiftCover.STATUS_APPROVED, actor.getId());
            return toCoverResponse(coverRepository.save(cover));
        }

        if (!actor.getId().equals(cover.getCoverUserId())) {
            throw new BusinessException(HttpStatus.FORBIDDEN, "지정된 대타자만 수락할 수 있습니다.");
        }
        if (!BrewShiftCover.STATUS_PENDING_COVER.equals(cover.getStatus())) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "대타자 수락 대기 상태가 아닙니다.");
        }
        cover.decide(BrewShiftCover.STATUS_APPROVED, actor.getId());
        return toCoverResponse(coverRepository.save(cover));
    }

    @Transactional
    public CoverResponse rejectCover(String email, UUID coverId) {
        User actor = requireUser(email);
        BrewShiftCover cover = requireCover(coverId);
        BrewStore store = requireStore(cover.getStoreId());
        boolean isOwner = store.getOwnerUserId().equals(actor.getId());

        if (BrewShiftCover.STATUS_PENDING_OWNER.equals(cover.getStatus())) {
            if (!isOwner) {
                throw new BusinessException(HttpStatus.FORBIDDEN, "업주만 거절할 수 있습니다.");
            }
            cover.decide(BrewShiftCover.STATUS_REJECTED, actor.getId());
        } else if (BrewShiftCover.STATUS_PENDING_COVER.equals(cover.getStatus())) {
            if (!actor.getId().equals(cover.getCoverUserId()) && !isOwner) {
                throw new BusinessException(HttpStatus.FORBIDDEN, "대타자 또는 업주만 거절할 수 있습니다.");
            }
            cover.decide(BrewShiftCover.STATUS_REJECTED, actor.getId());
        } else {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "거절할 수 있는 상태가 아닙니다.");
        }
        return toCoverResponse(coverRepository.save(cover));
    }

    @Transactional
    public CoverResponse cancelCover(String email, UUID coverId) {
        User actor = requireUser(email);
        BrewShiftCover cover = requireCover(coverId);
        BrewStore store = requireStore(cover.getStoreId());
        boolean isOwner = store.getOwnerUserId().equals(actor.getId());
        boolean isRequester = cover.getRequestedByUserId().equals(actor.getId());
        if (!isOwner && !isRequester) {
            throw new BusinessException(HttpStatus.FORBIDDEN, "신청자 또는 업주만 취소할 수 있습니다.");
        }
        String status = cover.getStatus();
        if (!BrewShiftCover.STATUS_PENDING_OWNER.equals(status)
                && !BrewShiftCover.STATUS_PENDING_COVER.equals(status)
                && !BrewShiftCover.STATUS_APPROVED.equals(status)) {
            throw new BusinessException(
                    HttpStatus.BAD_REQUEST,
                    "대기 중이거나 승인된 대체·추가만 취소할 수 있습니다."
            );
        }
        cover.cancel(actor.getId());
        return toCoverResponse(coverRepository.save(cover));
    }

    @Transactional(readOnly = true)
    public List<CoverResponse> listPendingCovers(String email, UUID storeId) {
        User user = requireUser(email);
        BrewStore store = requireStore(storeId);
        assertMember(store, user.getId());
        boolean owner = store.getOwnerUserId().equals(user.getId());
        // 대기 + 승인됨(취소 가능). 거절·취소 완료 건은 제외
        List<BrewShiftCover> covers = coverRepository
                .findByStoreIdAndStatusInOrderByWorkDateAscStartTimeAsc(
                        storeId,
                        List.of(
                                BrewShiftCover.STATUS_PENDING_OWNER,
                                BrewShiftCover.STATUS_PENDING_COVER,
                                BrewShiftCover.STATUS_APPROVED
                        ));
        if (!owner) {
            covers = covers.stream()
                    .filter(c -> user.getId().equals(c.getOriginalUserId())
                            || user.getId().equals(c.getCoverUserId())
                            || c.getRequestedByUserId().equals(user.getId()))
                    .toList();
        }
        Set<UUID> nicknameIds = new HashSet<>();
        for (BrewShiftCover cover : covers) {
            if (cover.getOriginalUserId() != null) {
                nicknameIds.add(cover.getOriginalUserId());
            }
            if (cover.getCoverUserId() != null) {
                nicknameIds.add(cover.getCoverUserId());
            }
        }
        Map<UUID, String> nicknames = nicknameMap(nicknameIds);
        return covers.stream()
                .map(cover -> toCoverResponse(cover, nicknames))
                .toList();
    }

    /**
     * Batch on-duty check for one viewer across many stores (list endpoints).
     * Missing / empty storeIds → empty map.
     */
    @Transactional(readOnly = true)
    public Map<UUID, Boolean> onDutyByStoreIds(
            UUID userId,
            Collection<UUID> storeIds,
            Map<UUID, BrewStoreSubscription> subsByStore
    ) {
        Map<UUID, Boolean> result = new HashMap<>();
        if (userId == null || storeIds == null || storeIds.isEmpty()) {
            return result;
        }
        List<UUID> ids = storeIds.stream().filter(id -> id != null).distinct().toList();
        if (ids.isEmpty()) {
            return result;
        }
        for (UUID id : ids) {
            result.put(id, false);
        }

        LocalDateTime now = BrewShiftTimes.nowSeoul();
        LocalDate today = now.toLocalDate();
        LocalDate yesterday = today.minusDays(1);
        List<LocalDate> nearby = List.of(today, yesterday);

        Map<UUID, List<BrewShiftCover>> asCoverByStore = coverRepository
                .findByStoreIdInAndCoverUserIdAndWorkDateInAndStatus(
                        ids, userId, nearby, BrewShiftCover.STATUS_APPROVED)
                .stream()
                .collect(Collectors.groupingBy(BrewShiftCover::getStoreId));
        Map<UUID, List<BrewShiftCover>> asOriginalByStore = coverRepository
                .findByStoreIdInAndOriginalUserIdAndWorkDateInAndStatus(
                        ids, userId, nearby, BrewShiftCover.STATUS_APPROVED)
                .stream()
                .collect(Collectors.groupingBy(BrewShiftCover::getStoreId));
        Map<UUID, List<BrewStaffSchedule>> schedulesByStore = scheduleRepository
                .findByStoreIdInAndUserId(ids, userId)
                .stream()
                .collect(Collectors.groupingBy(BrewStaffSchedule::getStoreId));
        Map<UUID, List<BrewStaffScheduleOverride>> overridesByStore = overrideRepository
                .findByStoreIdInAndUserIdAndWorkDateIn(ids, userId, nearby)
                .stream()
                .collect(Collectors.groupingBy(BrewStaffScheduleOverride::getStoreId));

        Map<UUID, BrewStoreSubscription> subs =
                subsByStore != null ? subsByStore : Map.of();
        for (UUID storeId : ids) {
            result.put(
                    storeId,
                    evaluateOnDuty(
                            now,
                            today,
                            yesterday,
                            subs.get(storeId),
                            asCoverByStore.getOrDefault(storeId, List.of()),
                            asOriginalByStore.getOrDefault(storeId, List.of()),
                            schedulesByStore.getOrDefault(storeId, List.of()),
                            overridesByStore.getOrDefault(storeId, List.of())));
        }
        return result;
    }

    @Transactional(readOnly = true)
    public boolean isCurrentlyOnDuty(UUID storeId, UUID userId) {
        Map<UUID, BrewStoreSubscription> subs = new HashMap<>();
        subscriptionRepository.findBySubscriberUserIdAndStoreId(userId, storeId)
                .ifPresent(sub -> subs.put(storeId, sub));
        return Boolean.TRUE.equals(onDutyByStoreIds(userId, List.of(storeId), subs).get(storeId));
    }

    @Transactional(readOnly = true)
    public BrewEffectiveShifts.Shift regularShiftOn(UUID storeId, UUID userId, LocalDate date) {
        var sub = subscriptionRepository.findBySubscriberUserIdAndStoreId(userId, storeId);
        if (sub.isPresent() && !sub.get().isActiveOn(date)) {
            return null;
        }
        return BrewEffectiveShifts.resolve(
                scheduleRepository.findByStoreIdAndUserIdOrderByDayOfWeekAsc(storeId, userId),
                overrideRepository.findByStoreIdAndUserIdAndWorkDate(storeId, userId, date)
                        .orElse(null),
                date
        );
    }

    private boolean evaluateOnDuty(
            LocalDateTime now,
            LocalDate today,
            LocalDate yesterday,
            BrewStoreSubscription sub,
            List<BrewShiftCover> asCover,
            List<BrewShiftCover> asOriginal,
            List<BrewStaffSchedule> schedules,
            List<BrewStaffScheduleOverride> overrides
    ) {
        for (BrewShiftCover cover : asCover) {
            if (BrewShiftTimes.isWithinShift(
                    now, cover.getWorkDate(), cover.getStartTime(), cover.getEndTime())) {
                return true;
            }
        }

        Set<LocalDate> coveredOutDates = asOriginal.stream()
                .filter(c -> BrewShiftCover.KIND_COVER.equals(
                        c.getShiftKind() == null ? BrewShiftCover.KIND_COVER : c.getShiftKind()))
                .map(BrewShiftCover::getWorkDate)
                .collect(Collectors.toSet());

        Map<LocalDate, BrewStaffScheduleOverride> overrideByDate = new HashMap<>();
        for (BrewStaffScheduleOverride override : overrides) {
            overrideByDate.put(override.getWorkDate(), override);
        }

        BrewEffectiveShifts.Shift todayShift = BrewEffectiveShifts.resolve(
                schedules, overrideByDate.get(today), today);
        if (todayShift != null
                && (sub == null || sub.isActiveOn(today))
                && !coveredOutDates.contains(today)
                && BrewShiftTimes.isWithinShift(now, today, todayShift.start(), todayShift.end())) {
            return true;
        }
        BrewEffectiveShifts.Shift yesterdayShift = BrewEffectiveShifts.resolve(
                schedules, overrideByDate.get(yesterday), yesterday);
        return yesterdayShift != null
                && yesterdayShift.overnight()
                && (sub == null || sub.isActiveOn(yesterday))
                && !coveredOutDates.contains(yesterday)
                && BrewShiftTimes.isWithinShift(
                now, yesterday, yesterdayShift.start(), yesterdayShift.end());
    }

    private void assertNoActiveCoverConflict(UUID storeId, UUID originalUserId, LocalDate workDate) {
        List<BrewShiftCover> existing = coverRepository
                .findByStoreIdAndOriginalUserIdAndWorkDateAndStatusIn(
                        storeId,
                        originalUserId,
                        workDate,
                        ACTIVE_COVER_STATUSES
                ).stream()
                .filter(c -> BrewShiftCover.KIND_COVER.equals(
                        c.getShiftKind() == null ? BrewShiftCover.KIND_COVER : c.getShiftKind()))
                .toList();
        if (!existing.isEmpty()) {
            throw new BusinessException(
                    HttpStatus.CONFLICT,
                    "해당 날짜에 이미 진행 중이거나 승인된 대타가 있습니다."
            );
        }
    }

    private CoverResponse toCoverResponse(BrewShiftCover cover) {
        Set<UUID> ids = new HashSet<>();
        if (cover.getOriginalUserId() != null) {
            ids.add(cover.getOriginalUserId());
        }
        if (cover.getCoverUserId() != null) {
            ids.add(cover.getCoverUserId());
        }
        return toCoverResponse(cover, nicknameMap(ids));
    }

    private CoverResponse toCoverResponse(BrewShiftCover cover, Map<UUID, String> nicknames) {
        return CoverResponse.from(
                cover,
                cover.getOriginalUserId() == null
                        ? ""
                        : nicknames.getOrDefault(cover.getOriginalUserId(), ""),
                cover.getCoverUserId() == null
                        ? ""
                        : nicknames.getOrDefault(cover.getCoverUserId(), "")
        );
    }

    private void validateCoverUser(
            UUID storeId,
            UUID originalUserId,
            UUID coverUserId,
            LocalDate workDate,
            LocalTime startTime,
            LocalTime endTime
    ) {
        if (originalUserId != null && originalUserId.equals(coverUserId)) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "본인을 대타로 지정할 수 없습니다.");
        }
        requireSubscriber(storeId, coverUserId);

        LocalDateTime coverFrom = BrewShiftTimes.rangeStart(workDate, startTime);
        LocalDateTime coverTo = BrewShiftTimes.rangeEnd(workDate, startTime, endTime);
        // 자정 넘김을 고려해 전날·당일·다음날 근무를 모두 겹침 후보로 본다
        List<LocalDate> nearbyDates =
                List.of(workDate.minusDays(1), workDate, workDate.plusDays(1));

        // 본인 근무가 다른 대체(COVER)로 이미 넘어간 날은 근무 없는 것으로 취급
        Set<LocalDate> coveredOutDates = coverRepository
                .findByStoreIdAndOriginalUserIdAndWorkDateInAndStatus(
                        storeId, coverUserId, nearbyDates, BrewShiftCover.STATUS_APPROVED)
                .stream()
                .filter(c -> BrewShiftCover.KIND_COVER.equals(
                        c.getShiftKind() == null ? BrewShiftCover.KIND_COVER : c.getShiftKind()))
                .map(BrewShiftCover::getWorkDate)
                .collect(Collectors.toSet());

        List<BrewStaffSchedule> candidateSchedules =
                scheduleRepository.findByStoreIdAndUserIdOrderByDayOfWeekAsc(storeId, coverUserId);
        List<BrewStaffScheduleOverride> nearbyOverrides =
                overrideRepository.findByStoreIdAndUserIdAndWorkDateIn(
                        storeId, coverUserId, nearbyDates);
        Map<LocalDate, BrewStaffScheduleOverride> overrideByDate = new HashMap<>();
        for (BrewStaffScheduleOverride override : nearbyOverrides) {
            overrideByDate.put(override.getWorkDate(), override);
        }
        for (LocalDate date : nearbyDates) {
            if (coveredOutDates.contains(date)) {
                continue;
            }
            BrewEffectiveShifts.Shift shift = BrewEffectiveShifts.resolve(
                    candidateSchedules, overrideByDate.get(date), date);
            if (shift == null) {
                continue;
            }
            LocalDateTime shiftFrom = BrewShiftTimes.rangeStart(date, shift.start());
            LocalDateTime shiftTo = BrewShiftTimes.rangeEnd(date, shift.start(), shift.end());
            if (overlaps(coverFrom, coverTo, shiftFrom, shiftTo)) {
                throw new BusinessException(
                        HttpStatus.CONFLICT,
                        "해당 시간에 정규 근무가 있는 직원은 지정할 수 없습니다."
                );
            }
        }

        List<BrewShiftCover> approvedAsCover = coverRepository
                .findByStoreIdAndCoverUserIdAndWorkDateInAndStatus(
                        storeId, coverUserId, nearbyDates, BrewShiftCover.STATUS_APPROVED);
        for (BrewShiftCover other : approvedAsCover) {
            LocalDateTime otherFrom =
                    BrewShiftTimes.rangeStart(other.getWorkDate(), other.getStartTime());
            LocalDateTime otherTo = BrewShiftTimes.rangeEnd(
                    other.getWorkDate(), other.getStartTime(), other.getEndTime());
            if (overlaps(coverFrom, coverTo, otherFrom, otherTo)) {
                throw new BusinessException(
                        HttpStatus.CONFLICT,
                        "해당 시간에 승인된 다른 근무(대체/추가)가 있는 직원은 지정할 수 없습니다."
                );
            }
        }
    }

    private boolean overlaps(
            LocalDateTime aFrom,
            LocalDateTime aTo,
            LocalDateTime bFrom,
            LocalDateTime bTo
    ) {
        return aFrom.isBefore(bTo) && bFrom.isBefore(aTo);
    }

    private Map<UUID, String> nicknameMap(Set<UUID> userIds) {
        return userService.nicknameMap(userIds);
    }

    private String nicknameOf(UUID userId) {
        return userService.findById(userId).map(User::getNickname).orElse("");
    }

    private LocalDate requireApplyDate(ReplaceSchedulesRequest request, LocalDate today) {
        LocalDate from = request.effectiveFrom();
        if (from == null) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "적용 날짜를 선택해 주세요.");
        }
        if (from.isBefore(today.minusYears(1)) || from.isAfter(today.plusYears(1))) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "적용 날짜는 오늘 기준 1년 이내여야 합니다.");
        }
        return from;
    }

    private void saveOnceOverride(
            UUID storeId,
            UUID targetUserId,
            LocalDate date,
            Map<Integer, ScheduleSlotRequest> slotsByDay
    ) {
        int dow = date.getDayOfWeek().getValue();
        ScheduleSlotRequest slot = slotsByDay.get(dow);
        boolean active = slot != null;
        LocalTime start = active ? slot.startTime() : null;
        LocalTime end = active ? slot.endTime() : null;
        BrewStaffScheduleOverride existing = overrideRepository
                .findByStoreIdAndUserIdAndWorkDate(storeId, targetUserId, date)
                .orElse(null);
        if (existing == null) {
            overrideRepository.save(BrewStaffScheduleOverride.builder()
                    .storeId(storeId)
                    .userId(targetUserId)
                    .workDate(date)
                    .startTime(start)
                    .endTime(end)
                    .active(active)
                    .build());
            return;
        }
        existing.update(start, end, active);
        overrideRepository.save(existing);
    }

    private void saveWeeklyFrom(
            UUID storeId,
            UUID targetUserId,
            LocalDate from,
            Map<Integer, ScheduleSlotRequest> slotsByDay
    ) {
        List<BrewStaffSchedule> existing =
                scheduleRepository.findByStoreIdAndUserIdOrderByDayOfWeekAsc(storeId, targetUserId);
        List<BrewStaffSchedule> future = existing.stream()
                .filter(s -> s.getEffectiveFrom().isAfter(from))
                .toList();
        if (!future.isEmpty()) {
            scheduleRepository.deleteAll(future);
        }

        Map<Integer, BrewStaffSchedule> atFrom = new HashMap<>();
        Map<Integer, BrewStaffSchedule> latestOnOrBefore = new HashMap<>();
        for (BrewStaffSchedule schedule : existing) {
            if (schedule.getEffectiveFrom().isAfter(from)) {
                continue;
            }
            BrewStaffSchedule current = latestOnOrBefore.get(schedule.getDayOfWeek());
            if (current == null || schedule.getEffectiveFrom().isAfter(current.getEffectiveFrom())) {
                latestOnOrBefore.put(schedule.getDayOfWeek(), schedule);
            }
            if (schedule.getEffectiveFrom().equals(from)) {
                atFrom.put(schedule.getDayOfWeek(), schedule);
            }
        }

        List<BrewStaffSchedule> toSave = new ArrayList<>();
        for (int day = 1; day <= 7; day++) {
            ScheduleSlotRequest slot = slotsByDay.get(day);
            BrewStaffSchedule row = atFrom.get(day);
            if (slot != null) {
                if (row == null) {
                    toSave.add(BrewStaffSchedule.builder()
                            .storeId(storeId)
                            .userId(targetUserId)
                            .dayOfWeek(day)
                            .startTime(slot.startTime())
                            .endTime(slot.endTime())
                            .effectiveFrom(from)
                            .active(true)
                            .build());
                } else {
                    row.update(slot.startTime(), slot.endTime(), true);
                    toSave.add(row);
                }
                continue;
            }
            BrewStaffSchedule prior = latestOnOrBefore.get(day);
            if (prior == null || !prior.isActive()) {
                continue;
            }
            if (row == null) {
                toSave.add(BrewStaffSchedule.builder()
                        .storeId(storeId)
                        .userId(targetUserId)
                        .dayOfWeek(day)
                        .startTime(prior.getStartTime())
                        .endTime(prior.getEndTime())
                        .effectiveFrom(from)
                        .active(false)
                        .build());
            } else {
                row.update(prior.getStartTime(), prior.getEndTime(), false);
                toSave.add(row);
            }
        }
        if (!toSave.isEmpty()) {
            scheduleRepository.saveAll(toSave);
        }
    }

    private String trimNote(String note) {
        if (note == null) {
            return null;
        }
        String trimmed = note.trim();
        return trimmed.isEmpty() ? null : trimmed.substring(0, Math.min(500, trimmed.length()));
    }

    private User requireUser(String email) {
        return userService.findByEmail(email.trim().toLowerCase())
                .orElseThrow(() -> new BusinessException(HttpStatus.UNAUTHORIZED, "로그인이 필요합니다."));
    }

    private BrewStore requireStore(UUID storeId) {
        return storeRepository.findById(storeId)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "가게를 찾을 수 없습니다."));
    }

    private BrewStore requireOwnedStore(UUID storeId, UUID ownerId) {
        BrewStore store = requireStore(storeId);
        if (!store.getOwnerUserId().equals(ownerId)) {
            throw new BusinessException(HttpStatus.FORBIDDEN, "가게 소유자만 관리할 수 있습니다.");
        }
        return store;
    }

    private void assertMember(BrewStore store, UUID userId) {
        if (store.getOwnerUserId().equals(userId)) {
            return;
        }
        if (subscriptionRepository.existsBySubscriberUserIdAndStoreId(userId, store.getId())) {
            return;
        }
        throw new BusinessException(HttpStatus.FORBIDDEN, "가게 구성원만 이용할 수 있습니다.");
    }

    private void requireSubscriber(UUID storeId, UUID userId) {
        if (!subscriptionRepository.existsBySubscriberUserIdAndStoreId(userId, storeId)) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "해당 사용자는 이 가게의 직원이 아닙니다.");
        }
    }

    private BrewShiftCover requireCover(UUID coverId) {
        return coverRepository.findById(coverId)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "대타 요청을 찾을 수 없습니다."));
    }

    /** 퇴사 처리: 정규 근무 삭제 + 퇴사일 이후 연관 대체/추가 삭제 */
    @Transactional
    public void purgeStaffMembership(UUID storeId, UUID userId, LocalDate leaveDate) {
        scheduleRepository.deleteByStoreIdAndUserId(storeId, userId);
        overrideRepository.deleteByStoreIdAndUserId(storeId, userId);
        deleteCoversAfterLeaveDate(storeId, userId, leaveDate);
    }

    /**
     * 퇴사일 이후(workDate &gt; leaveDate) 연관 대기·승인 대체/추가를 삭제.
     * 퇴사일 당일·이전 건은 유지.
     */
    @Transactional
    public void deleteCoversAfterLeaveDate(UUID storeId, UUID userId, LocalDate leaveDate) {
        List<BrewShiftCover> covers = coverRepository.findInvolvingUserAfterLeaveDate(
                storeId,
                userId,
                leaveDate,
                List.of(
                        BrewShiftCover.STATUS_PENDING_OWNER,
                        BrewShiftCover.STATUS_PENDING_COVER,
                        BrewShiftCover.STATUS_APPROVED
                ));
        if (!covers.isEmpty()) {
            coverRepository.deleteAll(covers);
        }
    }

    @Transactional(readOnly = true)
    public int countCoversAfterLeaveDate(
            String email,
            UUID storeId,
            UUID targetUserId,
            LocalDate leaveDate
    ) {
        User user = requireUser(email);
        BrewStore store = requireStore(storeId);
        assertMember(store, user.getId());
        boolean owner = store.getOwnerUserId().equals(user.getId());
        if (!owner && !user.getId().equals(targetUserId)) {
            throw new BusinessException(HttpStatus.FORBIDDEN, "본인 또는 업주만 조회할 수 있습니다.");
        }
        return coverRepository.findInvolvingUserAfterLeaveDate(
                storeId,
                targetUserId,
                leaveDate,
                List.of(
                        BrewShiftCover.STATUS_PENDING_OWNER,
                        BrewShiftCover.STATUS_PENDING_COVER,
                        BrewShiftCover.STATUS_APPROVED
                )).size();
    }
}
