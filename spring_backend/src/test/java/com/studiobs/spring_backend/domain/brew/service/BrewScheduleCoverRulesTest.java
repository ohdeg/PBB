package com.studiobs.spring_backend.domain.brew.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.studiobs.spring_backend.domain.brew.dto.CreateCoverRequest;
import com.studiobs.spring_backend.domain.brew.entity.BrewShiftCover;
import com.studiobs.spring_backend.domain.brew.entity.BrewStaffSchedule;
import com.studiobs.spring_backend.domain.brew.entity.BrewStore;
import com.studiobs.spring_backend.domain.brew.repository.BrewShiftCoverRepository;
import com.studiobs.spring_backend.domain.brew.repository.BrewStaffScheduleOverrideRepository;
import com.studiobs.spring_backend.domain.brew.repository.BrewStaffScheduleRepository;
import com.studiobs.spring_backend.domain.brew.repository.BrewStoreRepository;
import com.studiobs.spring_backend.domain.brew.repository.BrewStoreSubscriptionRepository;
import com.studiobs.spring_backend.domain.user.entity.User;
import com.studiobs.spring_backend.domain.user.entity.UserClass;
import com.studiobs.spring_backend.domain.user.service.UserService;
import com.studiobs.spring_backend.global.exception.BusinessException;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
class BrewScheduleCoverRulesTest {

    @Mock
    private UserService userService;
    @Mock
    private BrewStoreRepository storeRepository;
    @Mock
    private BrewStoreSubscriptionRepository subscriptionRepository;
    @Mock
    private BrewStaffScheduleRepository scheduleRepository;
    @Mock
    private BrewStaffScheduleOverrideRepository overrideRepository;
    @Mock
    private BrewShiftCoverRepository coverRepository;

    @InjectMocks
    private BrewScheduleService brewScheduleService;

    @Test
    void createCover_extraRejectsOriginalUserId() {
        UUID ownerId = UUID.randomUUID();
        UUID storeId = UUID.randomUUID();
        User owner = user("owner@example.com", ownerId);
        BrewStore store = store(storeId, ownerId);

        when(userService.findByEmail("owner@example.com")).thenReturn(Optional.of(owner));
        when(storeRepository.findById(storeId)).thenReturn(Optional.of(store));

        CreateCoverRequest request = new CreateCoverRequest(
                UUID.randomUUID(),
                UUID.randomUUID(),
                LocalDate.of(2026, 7, 28),
                LocalTime.of(9, 0),
                LocalTime.of(18, 0),
                BrewShiftCover.KIND_EXTRA,
                null
        );

        assertThatThrownBy(() -> brewScheduleService.createCover("owner@example.com", storeId, request))
                .isInstanceOf(BusinessException.class)
                .satisfies(ex -> {
                    BusinessException be = (BusinessException) ex;
                    assertThat(be.getStatus()).isEqualTo(HttpStatus.BAD_REQUEST);
                    assertThat(be.getMessage()).contains("원래 근무자가 없습니다");
                });

        verify(coverRepository, never()).save(any());
    }

    @Test
    void createCover_coverRequiresOriginalUserId() {
        UUID ownerId = UUID.randomUUID();
        UUID storeId = UUID.randomUUID();
        User owner = user("owner@example.com", ownerId);
        BrewStore store = store(storeId, ownerId);

        when(userService.findByEmail("owner@example.com")).thenReturn(Optional.of(owner));
        when(storeRepository.findById(storeId)).thenReturn(Optional.of(store));

        CreateCoverRequest request = new CreateCoverRequest(
                null,
                UUID.randomUUID(),
                LocalDate.of(2026, 7, 28),
                LocalTime.of(9, 0),
                LocalTime.of(18, 0),
                BrewShiftCover.KIND_COVER,
                null
        );

        assertThatThrownBy(() -> brewScheduleService.createCover("owner@example.com", storeId, request))
                .isInstanceOf(BusinessException.class)
                .satisfies(ex -> {
                    BusinessException be = (BusinessException) ex;
                    assertThat(be.getStatus()).isEqualTo(HttpStatus.BAD_REQUEST);
                    assertThat(be.getMessage()).contains("원래 근무자");
                });
    }

    @Test
    void createCover_rejectsOverlappingActiveCover() {
        UUID ownerId = UUID.randomUUID();
        UUID originalId = UUID.randomUUID();
        UUID coverId = UUID.randomUUID();
        UUID storeId = UUID.randomUUID();
        LocalDate workDate = LocalDate.of(2026, 7, 28);

        User owner = user("owner@example.com", ownerId);
        BrewStore store = store(storeId, ownerId);

        when(userService.findByEmail("owner@example.com")).thenReturn(Optional.of(owner));
        when(storeRepository.findById(storeId)).thenReturn(Optional.of(store));
        when(subscriptionRepository.existsBySubscriberUserIdAndStoreId(originalId, storeId))
                .thenReturn(true);
        when(subscriptionRepository.existsBySubscriberUserIdAndStoreId(coverId, storeId))
                .thenReturn(true);
        when(scheduleRepository.findByStoreIdAndUserIdOrderByDayOfWeekAsc(storeId, coverId))
                .thenReturn(List.of());
        when(coverRepository.findByStoreIdAndOriginalUserIdAndWorkDateInAndStatus(
                        eq(storeId), eq(coverId), anyList(), eq(BrewShiftCover.STATUS_APPROVED)))
                .thenReturn(List.of());

        BrewShiftCover existing = BrewShiftCover.builder()
                .storeId(storeId)
                .originalUserId(originalId)
                .coverUserId(coverId)
                .workDate(workDate)
                .startTime(LocalTime.of(9, 0))
                .endTime(LocalTime.of(18, 0))
                .shiftKind(BrewShiftCover.KIND_COVER)
                .initiatorType(BrewShiftCover.INITIATOR_OWNER)
                .requestedByUserId(ownerId)
                .status(BrewShiftCover.STATUS_APPROVED)
                .build();
        when(coverRepository.findByStoreIdAndOriginalUserIdAndWorkDateAndStatusIn(
                        eq(storeId), eq(originalId), eq(workDate), anyList()))
                .thenReturn(List.of(existing));

        CreateCoverRequest request = new CreateCoverRequest(
                originalId,
                coverId,
                workDate,
                LocalTime.of(10, 0),
                LocalTime.of(14, 0),
                BrewShiftCover.KIND_COVER,
                null
        );

        assertThatThrownBy(() -> brewScheduleService.createCover("owner@example.com", storeId, request))
                .isInstanceOf(BusinessException.class)
                .satisfies(ex -> {
                    BusinessException be = (BusinessException) ex;
                    assertThat(be.getStatus()).isEqualTo(HttpStatus.CONFLICT);
                    assertThat(be.getMessage()).contains("이미 진행");
                });

        verify(coverRepository, never()).save(any());
    }

    @Test
    void lastShiftEndOn_usesOvernightRegularWhenNotCoveredOut() {
        UUID storeId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        LocalDate leave = LocalDate.of(2026, 8, 31);

        when(coverRepository.findByStoreIdAndCoverUserIdAndWorkDateGreaterThanEqualAndStatus(
                storeId, userId, leave, BrewShiftCover.STATUS_APPROVED))
                .thenReturn(List.of());
        when(coverRepository.findByStoreIdAndOriginalUserIdAndWorkDateAndStatusIn(
                eq(storeId), eq(userId), eq(leave), anyList()))
                .thenReturn(List.of());
        when(scheduleRepository.findByStoreIdAndUserIdOrderByDayOfWeekAsc(storeId, userId))
                .thenReturn(List.of(BrewStaffSchedule.builder()
                        .storeId(storeId)
                        .userId(userId)
                        .dayOfWeek(leave.getDayOfWeek().getValue())
                        .startTime(LocalTime.of(22, 0))
                        .endTime(LocalTime.of(8, 0))
                        .effectiveFrom(LocalDate.of(2020, 1, 1))
                        .active(true)
                        .build()));
        when(overrideRepository.findByStoreIdAndUserIdAndWorkDate(storeId, userId, leave))
                .thenReturn(Optional.empty());

        assertThat(brewScheduleService.lastShiftEndOn(storeId, userId, leave))
                .isEqualTo(LocalDateTime.of(2026, 9, 1, 8, 0));
    }

    @Test
    void lastShiftEndOn_includesLaterApprovedExtra() {
        UUID storeId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        LocalDate leave = LocalDate.of(2026, 8, 31);
        BrewShiftCover extra = BrewShiftCover.builder()
                .storeId(storeId)
                .coverUserId(userId)
                .workDate(leave.plusDays(5))
                .startTime(LocalTime.of(9, 0))
                .endTime(LocalTime.of(18, 0))
                .shiftKind(BrewShiftCover.KIND_EXTRA)
                .initiatorType(BrewShiftCover.INITIATOR_OWNER)
                .requestedByUserId(userId)
                .status(BrewShiftCover.STATUS_APPROVED)
                .build();

        when(coverRepository.findByStoreIdAndCoverUserIdAndWorkDateGreaterThanEqualAndStatus(
                storeId, userId, leave, BrewShiftCover.STATUS_APPROVED))
                .thenReturn(List.of(extra));
        when(coverRepository.findByStoreIdAndOriginalUserIdAndWorkDateAndStatusIn(
                eq(storeId), eq(userId), eq(leave), anyList()))
                .thenReturn(List.of());
        when(scheduleRepository.findByStoreIdAndUserIdOrderByDayOfWeekAsc(storeId, userId))
                .thenReturn(List.of());
        when(overrideRepository.findByStoreIdAndUserIdAndWorkDate(storeId, userId, leave))
                .thenReturn(Optional.empty());

        assertThat(brewScheduleService.lastShiftEndOn(storeId, userId, leave))
                .isEqualTo(LocalDateTime.of(2026, 9, 5, 18, 0));
    }

    @Test
    void applyLeaveCoverAdjustments_convertsAssignedCoverAndKeepsOwnExtra() {
        UUID storeId = UUID.randomUUID();
        UUID leaver = UUID.randomUUID();
        UUID other = UUID.randomUUID();
        LocalDate leave = LocalDate.of(2026, 8, 31);

        BrewShiftCover assigned = BrewShiftCover.builder()
                .storeId(storeId)
                .originalUserId(leaver)
                .coverUserId(other)
                .workDate(leave.plusDays(1))
                .startTime(LocalTime.of(9, 0))
                .endTime(LocalTime.of(18, 0))
                .shiftKind(BrewShiftCover.KIND_COVER)
                .initiatorType(BrewShiftCover.INITIATOR_OWNER)
                .requestedByUserId(other)
                .status(BrewShiftCover.STATUS_APPROVED)
                .build();
        BrewShiftCover ownExtra = BrewShiftCover.builder()
                .storeId(storeId)
                .coverUserId(leaver)
                .workDate(leave.plusDays(2))
                .startTime(LocalTime.of(10, 0))
                .endTime(LocalTime.of(14, 0))
                .shiftKind(BrewShiftCover.KIND_EXTRA)
                .initiatorType(BrewShiftCover.INITIATOR_EMPLOYEE)
                .requestedByUserId(leaver)
                .status(BrewShiftCover.STATUS_APPROVED)
                .build();
        BrewShiftCover open = BrewShiftCover.builder()
                .storeId(storeId)
                .originalUserId(leaver)
                .workDate(leave.plusDays(3))
                .startTime(LocalTime.of(9, 0))
                .endTime(LocalTime.of(18, 0))
                .shiftKind(BrewShiftCover.KIND_COVER)
                .initiatorType(BrewShiftCover.INITIATOR_OWNER)
                .requestedByUserId(leaver)
                .status(BrewShiftCover.STATUS_PENDING_OWNER)
                .build();

        when(coverRepository.findInvolvingUserAfterLeaveDate(eq(storeId), eq(leaver), eq(leave), anyList()))
                .thenReturn(List.of(assigned, ownExtra, open));

        brewScheduleService.applyLeaveCoverAdjustments(storeId, leaver, leave);

        assertThat(assigned.getShiftKind()).isEqualTo(BrewShiftCover.KIND_EXTRA);
        assertThat(assigned.getOriginalUserId()).isNull();
        verify(coverRepository).save(assigned);
        verify(coverRepository).deleteAll(List.of(open));
    }

    private static User user(String email, UUID id) {
        User u = User.builder()
                .email(email)
                .password("hash")
                .nickname(email.split("@")[0])
                .userClass(UserClass.FREE)
                .build();
        ReflectionTestUtils.setField(u, "id", id);
        return u;
    }

    private static BrewStore store(UUID id, UUID ownerId) {
        BrewStore store = BrewStore.builder()
                .ownerUserId(ownerId)
                .name("Cafe")
                .isPublic(true)
                .inviteCode("ABCD1234")
                .build();
        ReflectionTestUtils.setField(store, "id", id);
        return store;
    }
}
