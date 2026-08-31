package com.studiobs.spring_backend.domain.brew.service;

import com.studiobs.spring_backend.domain.brew.dto.ChecklistCheckRequest;
import com.studiobs.spring_backend.domain.brew.dto.ChecklistRequest;
import com.studiobs.spring_backend.domain.brew.dto.ChecklistTemplateResponse;
import com.studiobs.spring_backend.domain.brew.dto.ChecklistTodayItemResponse;
import com.studiobs.spring_backend.domain.brew.dto.ChecklistTodayResponse;
import com.studiobs.spring_backend.domain.brew.entity.BrewChecklistCheck;
import com.studiobs.spring_backend.domain.brew.entity.BrewChecklistCheckId;
import com.studiobs.spring_backend.domain.brew.entity.BrewChecklistItem;
import com.studiobs.spring_backend.domain.brew.entity.BrewChecklistRun;
import com.studiobs.spring_backend.domain.brew.entity.BrewChecklistTemplate;
import com.studiobs.spring_backend.domain.brew.entity.BrewStore;
import com.studiobs.spring_backend.domain.brew.repository.BrewChecklistCheckRepository;
import com.studiobs.spring_backend.domain.brew.repository.BrewChecklistItemRepository;
import com.studiobs.spring_backend.domain.brew.repository.BrewChecklistRunRepository;
import com.studiobs.spring_backend.domain.brew.repository.BrewChecklistTemplateRepository;
import com.studiobs.spring_backend.domain.brew.repository.BrewStoreRepository;
import com.studiobs.spring_backend.domain.brew.repository.BrewStoreSubscriptionRepository;
import com.studiobs.spring_backend.domain.brew.support.BrewChecklistOpen;
import com.studiobs.spring_backend.domain.brew.support.BrewChecklistOpen.ShiftWindow;
import com.studiobs.spring_backend.domain.brew.support.BrewEffectiveShifts;
import com.studiobs.spring_backend.domain.brew.support.BrewShiftTimes;
import com.studiobs.spring_backend.domain.brew.support.PosAccess;
import com.studiobs.spring_backend.domain.user.entity.User;
import com.studiobs.spring_backend.domain.user.service.UserService;
import com.studiobs.spring_backend.global.exception.BusinessException;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
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
public class BrewChecklistService {

    private static final Set<String> TRIGGERS = Set.of(
            BrewChecklistOpen.CLOCK,
            BrewChecklistOpen.SHIFT_START,
            BrewChecklistOpen.SHIFT_END,
            BrewChecklistOpen.MANUAL
    );

    private final UserService userService;
    private final BrewStoreRepository storeRepository;
    private final BrewStoreSubscriptionRepository subscriptionRepository;
    private final BrewChecklistTemplateRepository templateRepository;
    private final BrewChecklistItemRepository itemRepository;
    private final BrewChecklistRunRepository runRepository;
    private final BrewChecklistCheckRepository checkRepository;
    private final BrewScheduleService brewScheduleService;

    @Transactional(readOnly = true)
    public List<ChecklistTemplateResponse> list(String email, UUID storeId) {
        User user = requireUser(email);
        BrewStore store = requireStore(storeId);
        assertMember(store, user.getId());
        List<BrewChecklistTemplate> templates =
                templateRepository.findVisibleForMember(storeId, user.getId());
        boolean owner = store.getOwnerUserId().equals(user.getId());
        if (!owner) {
            templates = templates.stream()
                    .filter((template) ->
                            template.isPersonal()
                                    || !BrewChecklistOpen.OWNER_ONLY.equals(template.getAudience()))
                    .toList();
        }
        return mapTemplates(templates, owner, user.getId());
    }

    @Transactional
    public ChecklistTemplateResponse create(String email, UUID storeId, ChecklistRequest request) {
        PosAccess.forbidManagement();
        User user = requireUser(email);
        BrewStore store = requireStore(storeId);
        assertMember(store, user.getId());
        boolean owner = store.getOwnerUserId().equals(user.getId());
        if (!request.personal() && !owner) {
            throw new BusinessException(HttpStatus.FORBIDDEN, "STORE_CHECKLIST_OWNER_ONLY", "가게 목록은 사장님만 만들 수 있습니다.");
        }
        BrewChecklistTemplate template = templateRepository.save(BrewChecklistTemplate.builder()
                .storeId(storeId)
                .ownerUserId(request.personal() ? user.getId() : null)
                .title(request.title().trim())
                .triggerType(requireTrigger(request.triggerType()))
                .triggerTime(resolveTime(request.triggerType(), request.triggerTime()))
                .triggerDows(encodeDows(request.triggerDows()))
                .audience(resolveAudience(request.audience(), request.personal()))
                .interrupt(request.interrupt())
                .enabled(request.enabled())
                .sortOrder(0)
                .build());
        List<BrewChecklistItem> items = saveItems(template.getId(), request.items());
        return ChecklistTemplateResponse.from(template, items, true);
    }

    @Transactional
    public ChecklistTemplateResponse update(String email, UUID templateId, ChecklistRequest request) {
        PosAccess.forbidManagement();
        User user = requireUser(email);
        BrewChecklistTemplate template = requireTemplate(templateId);
        BrewStore store = requireStore(template.getStoreId());
        assertCanEdit(store, template, user.getId());
        template.update(
                request.title().trim(),
                requireTrigger(request.triggerType()),
                resolveTime(request.triggerType(), request.triggerTime()),
                encodeDows(request.triggerDows()),
                resolveAudience(request.audience(), template.isPersonal()),
                request.interrupt(),
                request.enabled()
        );
        itemRepository.deleteByTemplateId(templateId);
        List<BrewChecklistItem> items = saveItems(templateId, request.items());
        return ChecklistTemplateResponse.from(template, items, true);
    }

    @Transactional
    public void delete(String email, UUID templateId) {
        PosAccess.forbidManagement();
        User user = requireUser(email);
        BrewChecklistTemplate template = requireTemplate(templateId);
        BrewStore store = requireStore(template.getStoreId());
        assertCanEdit(store, template, user.getId());
        templateRepository.delete(template);
    }

    @Transactional(readOnly = true)
    public List<ChecklistTodayResponse> listToday(String email, UUID storeId) {
        User user = requireUser(email);
        BrewStore store = requireStore(storeId);
        assertMember(store, user.getId());
        List<BrewChecklistTemplate> templates =
                templateRepository.findVisibleForMember(storeId, user.getId());
        if (templates.isEmpty()) {
            return List.of();
        }
        LocalDateTime now = BrewShiftTimes.nowSeoul();
        LocalDate today = now.toLocalDate();
        boolean owner = store.getOwnerUserId().equals(user.getId());
        boolean onDuty = brewScheduleService.isCurrentlyOnDuty(storeId, user.getId());
        ShiftWindow todayShift = toWindow(today, brewScheduleService.regularShiftOn(storeId, user.getId(), today));
        ShiftWindow yesterdayShift = toWindow(
                today.minusDays(1),
                brewScheduleService.regularShiftOn(storeId, user.getId(), today.minusDays(1)));

        List<UUID> ids = templates.stream().map(BrewChecklistTemplate::getId).toList();
        Map<UUID, List<BrewChecklistItem>> itemsByTemplate = itemRepository
                .findByTemplateIdInOrderBySortOrderAscIdAsc(ids)
                .stream()
                .collect(Collectors.groupingBy(
                        BrewChecklistItem::getTemplateId,
                        LinkedHashMap::new,
                        Collectors.toList()));
        List<BrewChecklistRun> runs = runRepository.findByTemplateIdInAndRunOn(ids, today);
        Map<UUID, BrewChecklistRun> runByTemplate = runs.stream()
                .collect(Collectors.toMap(BrewChecklistRun::getTemplateId, run -> run));
        Map<UUID, List<BrewChecklistCheck>> checksByRun = loadChecks(runs);
        Map<UUID, String> nicknames = userService.nicknameMap(
                checksByRun.values().stream()
                        .flatMap(List::stream)
                        .map(BrewChecklistCheck::getUserId)
                        .distinct()
                        .toList());

        List<ChecklistTodayResponse> result = new ArrayList<>();
        for (BrewChecklistTemplate template : templates) {
            boolean due = BrewChecklistOpen.isDue(
                    template.getTriggerType(),
                    template.getTriggerTime(),
                    template.getTriggerDows(),
                    template.isEnabled(),
                    template.isPersonal(),
                    template.getAudience(),
                    owner,
                    onDuty,
                    now,
                    todayShift,
                    yesterdayShift
            );
            BrewChecklistRun run = runByTemplate.get(template.getId());
            if (!due && run == null) {
                continue;
            }
            if (!template.isPersonal()
                    && BrewChecklistOpen.OWNER_ONLY.equals(template.getAudience())
                    && !owner) {
                continue;
            }
            List<BrewChecklistItem> items =
                    itemsByTemplate.getOrDefault(template.getId(), List.of());
            Map<Integer, BrewChecklistCheck> checkByItem = run == null
                    ? Map.of()
                    : checksByRun.getOrDefault(run.getId(), List.of()).stream()
                            .collect(Collectors.toMap(BrewChecklistCheck::getItemId, check -> check));
            List<ChecklistTodayItemResponse> todayItems = new ArrayList<>(items.size());
            int checkedCount = 0;
            for (BrewChecklistItem item : items) {
                BrewChecklistCheck check = checkByItem.get(item.getId());
                boolean checked = check != null;
                if (checked) {
                    checkedCount += 1;
                }
                todayItems.add(new ChecklistTodayItemResponse(
                        item.getId(),
                        item.getBody(),
                        checked,
                        checked
                                ? nicknames.getOrDefault(check.getUserId(), "")
                                : ""
                ));
            }
            result.add(new ChecklistTodayResponse(
                    template.getId(),
                    template.getTitle(),
                    template.isPersonal(),
                    template.isInterrupt(),
                    due,
                    template.getTriggerType(),
                    checkedCount,
                    items.size(),
                    todayItems
            ));
        }
        return result;
    }

    @Transactional
    public List<ChecklistTodayResponse> openToday(String email, UUID storeId, UUID templateId) {
        User user = requireUser(email);
        BrewStore store = requireStore(storeId);
        assertMember(store, user.getId());
        BrewChecklistTemplate template = requireTemplate(templateId);
        if (!template.getStoreId().equals(storeId)) {
            throw new BusinessException(HttpStatus.NOT_FOUND, "CHECKLIST_NOT_FOUND", "체크리스트를 찾을 수 없습니다.");
        }
        assertVisible(template, user.getId(), store.getOwnerUserId().equals(user.getId()));
        LocalDate today = BrewShiftTimes.nowSeoul().toLocalDate();
        if (runRepository.findByTemplateIdAndRunOn(templateId, today).isEmpty()) {
            runRepository.save(new BrewChecklistRun(templateId, today));
        }
        return listToday(email, storeId);
    }

    @Transactional
    public List<ChecklistTodayResponse> setCheck(
            String email,
            UUID storeId,
            UUID templateId,
            ChecklistCheckRequest request
    ) {
        User user = requireUser(email);
        BrewStore store = requireStore(storeId);
        assertMember(store, user.getId());
        BrewChecklistTemplate template = requireTemplate(templateId);
        if (!template.getStoreId().equals(storeId)) {
            throw new BusinessException(HttpStatus.NOT_FOUND, "CHECKLIST_NOT_FOUND", "체크리스트를 찾을 수 없습니다.");
        }
        boolean owner = store.getOwnerUserId().equals(user.getId());
        assertVisible(template, user.getId(), owner);

        LocalDateTime now = BrewShiftTimes.nowSeoul();
        LocalDate today = now.toLocalDate();
        BrewChecklistRun run = runRepository.findByTemplateIdAndRunOn(templateId, today).orElse(null);
        if (run == null) {
            boolean due = BrewChecklistOpen.isDue(
                    template.getTriggerType(),
                    template.getTriggerTime(),
                    template.getTriggerDows(),
                    template.isEnabled(),
                    template.isPersonal(),
                    template.getAudience(),
                    owner,
                    brewScheduleService.isCurrentlyOnDuty(storeId, user.getId()),
                    now,
                    toWindow(today, brewScheduleService.regularShiftOn(storeId, user.getId(), today)),
                    toWindow(
                            today.minusDays(1),
                            brewScheduleService.regularShiftOn(storeId, user.getId(), today.minusDays(1)))
            );
            if (!due) {
                throw new BusinessException(HttpStatus.BAD_REQUEST, "CHECKLIST_NOT_OPEN", "아직 열리지 않은 체크리스트입니다.");
            }
            run = runRepository.save(new BrewChecklistRun(templateId, today));
        }

        BrewChecklistItem item = itemRepository.findById(request.itemId())
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "CHECKLIST_ITEM_NOT_FOUND", "항목을 찾을 수 없습니다."));
        if (!item.getTemplateId().equals(templateId)) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "CHECKLIST_ITEM_WRONG_LIST", "이 목록의 항목이 아닙니다.");
        }
        BrewChecklistCheckId checkId = new BrewChecklistCheckId(run.getId(), item.getId());
        if (request.checked()) {
            if (checkRepository.findById(checkId).isEmpty()) {
                checkRepository.save(new BrewChecklistCheck(run.getId(), item.getId(), user.getId()));
            }
        } else {
            checkRepository.deleteById(checkId);
        }
        return listToday(email, storeId);
    }

    private List<ChecklistTemplateResponse> mapTemplates(
            List<BrewChecklistTemplate> templates,
            boolean storeOwner,
            UUID userId
    ) {
        if (templates.isEmpty()) {
            return List.of();
        }
        Map<UUID, List<BrewChecklistItem>> itemsByTemplate = itemRepository
                .findByTemplateIdInOrderBySortOrderAscIdAsc(
                        templates.stream().map(BrewChecklistTemplate::getId).toList())
                .stream()
                .collect(Collectors.groupingBy(
                        BrewChecklistItem::getTemplateId,
                        LinkedHashMap::new,
                        Collectors.toList()));
        List<ChecklistTemplateResponse> result = new ArrayList<>(templates.size());
        for (BrewChecklistTemplate template : templates) {
            boolean canEdit = template.isPersonal()
                    ? userId.equals(template.getOwnerUserId())
                    : storeOwner;
            result.add(ChecklistTemplateResponse.from(
                    template,
                    itemsByTemplate.getOrDefault(template.getId(), List.of()),
                    canEdit));
        }
        return result;
    }

    private Map<UUID, List<BrewChecklistCheck>> loadChecks(List<BrewChecklistRun> runs) {
        if (runs.isEmpty()) {
            return Map.of();
        }
        return checkRepository.findByRunIdIn(
                        runs.stream().map(BrewChecklistRun::getId).toList())
                .stream()
                .collect(Collectors.groupingBy(BrewChecklistCheck::getRunId));
    }

    private List<BrewChecklistItem> saveItems(UUID templateId, List<String> bodies) {
        List<BrewChecklistItem> items = new ArrayList<>(bodies.size());
        int order = 0;
        for (String body : bodies) {
            String trimmed = body.trim();
            if (trimmed.isEmpty()) {
                continue;
            }
            items.add(new BrewChecklistItem(templateId, trimmed, order++));
        }
        if (items.isEmpty()) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "CHECKLIST_ITEMS_REQUIRED", "항목을 한 개 이상 입력해 주세요.");
        }
        return itemRepository.saveAll(items);
    }

    private static String requireTrigger(String raw) {
        String trigger = raw == null ? "" : raw.trim().toUpperCase();
        if (!TRIGGERS.contains(trigger)) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "CHECKLIST_TRIGGER_INVALID", "열림 조건을 확인해 주세요.");
        }
        return trigger;
    }

    private static LocalTime resolveTime(String triggerType, LocalTime triggerTime) {
        if (BrewChecklistOpen.CLOCK.equals(triggerType)) {
            if (triggerTime == null) {
                throw new BusinessException(HttpStatus.BAD_REQUEST, "CHECKLIST_TIME_REQUIRED", "시각을 입력해 주세요.");
            }
            return triggerTime;
        }
        return null;
    }

    private static String resolveAudience(String raw, boolean personal) {
        if (personal) {
            return BrewChecklistOpen.ON_DUTY;
        }
        if (raw == null || raw.isBlank()) {
            return BrewChecklistOpen.ON_DUTY;
        }
        String audience = raw.trim().toUpperCase();
        if (!BrewChecklistOpen.ON_DUTY.equals(audience)
                && !BrewChecklistOpen.OWNER_ONLY.equals(audience)) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "CHECKLIST_AUDIENCE_INVALID", "공개 대상을 확인해 주세요.");
        }
        return audience;
    }

    static String encodeDows(List<Integer> dows) {
        if (dows == null || dows.isEmpty()) {
            return null;
        }
        return dows.stream()
                .filter(dow -> dow != null && dow >= 1 && dow <= 7)
                .distinct()
                .sorted()
                .map(String::valueOf)
                .collect(Collectors.joining(","));
    }

    private static ShiftWindow toWindow(LocalDate date, BrewEffectiveShifts.Shift shift) {
        if (shift == null) {
            return null;
        }
        return new ShiftWindow(date, shift.start(), shift.end());
    }

    private User requireUser(String email) {
        return userService.findByEmail(email.trim().toLowerCase())
                .orElseThrow(() ->
                        new BusinessException(HttpStatus.UNAUTHORIZED, "LOGIN_REQUIRED", "로그인이 필요합니다."));
    }

    private BrewStore requireStore(UUID storeId) {
        return storeRepository.findById(storeId)
                .orElseThrow(() ->
                        new BusinessException(HttpStatus.NOT_FOUND, "STORE_NOT_FOUND", "가게를 찾을 수 없습니다."));
    }

    private BrewChecklistTemplate requireTemplate(UUID templateId) {
        return templateRepository.findById(templateId)
                .orElseThrow(() ->
                        new BusinessException(HttpStatus.NOT_FOUND, "CHECKLIST_NOT_FOUND", "체크리스트를 찾을 수 없습니다."));
    }

    private void assertMember(BrewStore store, UUID userId) {
        if (PosAccess.isPos()) {
            PosAccess.requireBoundStore(store.getId());
            return;
        }
        if (store.getOwnerUserId().equals(userId)) {
            return;
        }
        if (subscriptionRepository.existsBySubscriberUserIdAndStoreId(userId, store.getId())) {
            return;
        }
        throw new BusinessException(HttpStatus.FORBIDDEN, "MEMBERS_ONLY", "가게 구성원만 이용할 수 있습니다.");
    }

    private void assertCanEdit(BrewStore store, BrewChecklistTemplate template, UUID userId) {
        if (template.isPersonal()) {
            if (!userId.equals(template.getOwnerUserId())) {
                throw new BusinessException(HttpStatus.FORBIDDEN, "CHECKLIST_PERSONAL_ONLY", "본인 목록만 수정할 수 있습니다.");
            }
            return;
        }
        if (!store.getOwnerUserId().equals(userId)) {
            throw new BusinessException(HttpStatus.FORBIDDEN, "CHECKLIST_STORE_OWNER_EDIT", "가게 목록은 사장님만 수정할 수 있습니다.");
        }
    }

    private void assertVisible(BrewChecklistTemplate template, UUID userId, boolean storeOwner) {
        if (template.isPersonal() && !userId.equals(template.getOwnerUserId())) {
            throw new BusinessException(HttpStatus.FORBIDDEN, "CHECKLIST_OTHER_PERSON", "다른 사람의 목록입니다.");
        }
        if (!template.isPersonal()
                && BrewChecklistOpen.OWNER_ONLY.equals(template.getAudience())
                && !storeOwner) {
            throw new BusinessException(HttpStatus.FORBIDDEN, "CHECKLIST_OWNER_OPEN_ONLY", "사장님만 열 수 있는 목록입니다.");
        }
    }
}
