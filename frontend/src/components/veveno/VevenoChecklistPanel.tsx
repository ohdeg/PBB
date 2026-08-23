import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { vevenoApi } from '../../api/vevenoApi';
import { getErrorMessage } from '../../utils/error';
import type {
  VevenoChecklistAudience,
  VevenoChecklistInput,
  VevenoChecklistTemplate,
  VevenoChecklistToday,
  VevenoChecklistTrigger,
} from '../../types/veveno';
import { VevenoBadge } from './VevenoBadge';
import { VevenoButton } from './VevenoButton';
import { VevenoCard } from './VevenoCard';
import { VevenoEmptyState } from './VevenoEmptyState';
import { VevenoInput } from './VevenoInput';
import { VevenoModal } from './VevenoModal';
import { VevenoTimeInput } from './VevenoTimeInput';

const DOWS: { value: number; label: string }[] = [
  { value: 1, label: '월' },
  { value: 2, label: '화' },
  { value: 3, label: '수' },
  { value: 4, label: '목' },
  { value: 5, label: '금' },
  { value: 6, label: '토' },
  { value: 7, label: '일' },
];

const TRIGGER_LABEL: Record<VevenoChecklistTrigger, string> = {
  CLOCK: '시각',
  SHIFT_START: '오픈',
  SHIFT_END: '마감',
  MANUAL: '직접 열기',
};

interface FormState {
  title: string;
  triggerType: VevenoChecklistTrigger;
  triggerTime: string;
  triggerDows: number[];
  audience: VevenoChecklistAudience;
  interrupt: boolean;
  enabled: boolean;
  personal: boolean;
  items: string[];
}

const EMPTY_FORM: FormState = {
  title: '',
  triggerType: 'CLOCK',
  triggerTime: '08:50',
  triggerDows: [],
  audience: 'ON_DUTY',
  interrupt: false,
  enabled: true,
  personal: false,
  items: [''],
};

const SAMPLE_OPEN: VevenoChecklistInput = {
  title: '오픈',
  triggerType: 'SHIFT_START',
  triggerTime: null,
  triggerDows: [],
  audience: 'ON_DUTY',
  interrupt: true,
  enabled: true,
  personal: false,
  items: [
    '문·조명',
    '머신 워밍',
    '그라인더 퍼지',
    '우유·시럽',
    '아이스',
    '홀 정리',
    '카운터',
    '오프닝 캐시',
  ],
};

const SAMPLE_CLOSE: VevenoChecklistInput = {
  title: '마감',
  triggerType: 'SHIFT_END',
  triggerTime: null,
  triggerDows: [],
  audience: 'ON_DUTY',
  interrupt: false,
  enabled: true,
  personal: false,
  items: ['머신 백플러시', '우유 비우기', '홀 청소', '쓰레기', '재고 메모', '문·조명'],
};

function toInput(form: FormState): VevenoChecklistInput {
  return {
    title: form.title.trim(),
    triggerType: form.triggerType,
    triggerTime: form.triggerType === 'CLOCK' ? form.triggerTime : null,
    triggerDows: form.triggerType === 'CLOCK' ? form.triggerDows : [],
    audience: form.audience,
    interrupt: form.interrupt,
    enabled: form.enabled,
    personal: form.personal,
    items: form.items.map((item) => item.trim()).filter((item) => item.length > 0),
  };
}

function isTodayComplete(list: VevenoChecklistToday): boolean {
  return list.totalCount > 0 && list.checkedCount >= list.totalCount;
}

function fromInput(input: VevenoChecklistInput): FormState {
  return {
    title: input.title,
    triggerType: input.triggerType,
    triggerTime: (input.triggerTime ?? '08:50').slice(0, 5),
    triggerDows: input.triggerDows,
    audience: input.audience,
    interrupt: input.interrupt,
    enabled: input.enabled,
    personal: input.personal,
    items: input.items.concat(['']).slice(0, 40),
  };
}

function fromTemplate(template: VevenoChecklistTemplate): FormState {
  return {
    title: template.title,
    triggerType: template.triggerType,
    triggerTime: (template.triggerTime ?? '08:50').slice(0, 5),
    triggerDows: template.triggerDows,
    audience: template.audience,
    interrupt: template.interrupt,
    enabled: template.enabled,
    personal: template.personal,
    items: template.items.map((item) => item.body).concat(['']).slice(0, 40),
  };
}

interface VevenoChecklistPanelProps {
  storeId: string;
  owned: boolean;
  today: VevenoChecklistToday[];
  onTodayChange: (next: VevenoChecklistToday[]) => void;
  onError: (message: string) => void;
}

export function VevenoChecklistPanel({
  storeId,
  owned,
  today,
  onTodayChange,
  onError,
}: VevenoChecklistPanelProps) {
  const [templates, setTemplates] = useState<VevenoChecklistTemplate[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [checkModalId, setCheckModalId] = useState<string | null>(null);

  const loadTemplates = useCallback(async () => {
    const { data } = await vevenoApi.listChecklists(storeId);
    setTemplates(data);
  }, [storeId]);

  useEffect(() => {
    void loadTemplates().catch((err: unknown) => {
      onError(getErrorMessage(err, '할 일을 불러오지 못했습니다.'));
    });
  }, [loadTemplates, onError]);

  const openCreate = (personal: boolean) => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, personal: personal || !owned });
    setFormOpen(true);
  };

  const openEdit = (template: VevenoChecklistTemplate) => {
    setEditingId(template.id);
    setForm(fromTemplate(template));
    setFormOpen(true);
  };

  const openSample = (input: VevenoChecklistInput) => {
    setEditingId(null);
    setForm(fromInput(input));
    setFormOpen(true);
  };

  const handleSave = async (event: FormEvent) => {
    event.preventDefault();
    const payload = toInput(form);
    if (!payload.title || payload.items.length === 0) {
      onError('이름과 항목을 입력해 주세요.');
      return;
    }
    setSaving(true);
    onError('');
    try {
      if (editingId) {
        await vevenoApi.updateChecklist(editingId, payload);
      } else {
        await vevenoApi.createChecklist(storeId, payload);
      }
      setFormOpen(false);
      await loadTemplates();
      const { data } = await vevenoApi.listTodayChecklists(storeId);
      onTodayChange(data);
    } catch (err: unknown) {
      onError(getErrorMessage(err, '저장에 실패했습니다.'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (template: VevenoChecklistTemplate) => {
    if (!window.confirm(`「${template.title}」을 지울까요?`)) {
      return;
    }
    try {
      await vevenoApi.deleteChecklist(template.id);
      await loadTemplates();
    } catch (err: unknown) {
      onError(getErrorMessage(err, '삭제에 실패했습니다.'));
    }
  };

  const handleCheck = async (
    templateId: string,
    itemId: number,
    checked: boolean,
  ) => {
    try {
      const { data } = await vevenoApi.setChecklistCheck(storeId, templateId, {
        itemId,
        checked,
      });
      onTodayChange(data);
    } catch (err: unknown) {
      onError(getErrorMessage(err, '체크에 실패했습니다.'));
    }
  };

  const handleOpenToday = async (templateId: string) => {
    try {
      const { data } = await vevenoApi.openTodayChecklist(storeId, templateId);
      onTodayChange(data);
      setCheckModalId(templateId);
    } catch (err: unknown) {
      onError(getErrorMessage(err, '목록을 열지 못했습니다.'));
    }
  };

  const storeTemplates = useMemo(
    () => templates.filter((template) => !template.personal),
    [templates],
  );
  const personalTemplates = useMemo(
    () => templates.filter((template) => template.personal),
    [templates],
  );
  const doneTodayIds = useMemo(
    () => new Set(today.filter(isTodayComplete).map((list) => list.templateId)),
    [today],
  );
  const dueToday = useMemo(() => today.filter((list) => list.due), [today]);
  const checkModal = today.find((list) => list.templateId === checkModalId) ?? null;
  const missingOpen =
    owned && !storeTemplates.some((template) => template.triggerType === 'SHIFT_START');
  const missingClose =
    owned && !storeTemplates.some((template) => template.triggerType === 'SHIFT_END');
  const seedCards =
    missingOpen || missingClose ? (
      <SampleSeedCards
        missingOpen={missingOpen}
        missingClose={missingClose}
        onOpenOpen={() => openSample(SAMPLE_OPEN)}
        onOpenClose={() => openSample(SAMPLE_CLOSE)}
      />
    ) : null;

  if (templates.length === 0 && today.length === 0) {
    return (
      <>
        {owned ? (
          <div className="veveno-stack-lg">
            {seedCards}
            <VevenoButton variant="ghost" onClick={() => openCreate(false)}>
              직접 만들기
            </VevenoButton>
          </div>
        ) : (
          <VevenoEmptyState
            title="아직 할 일이 없습니다"
            body="나만 보는 할 일을 만들어 두세요. 가게 목록은 사장님이 만듭니다."
            action={
              <VevenoButton onClick={() => openCreate(true)}>내 할 일 만들기</VevenoButton>
            }
          />
        )}
        <ChecklistFormModal
          open={formOpen}
          owned={owned}
          editing={Boolean(editingId)}
          form={form}
          saving={saving}
          onChange={setForm}
          onClose={() => setFormOpen(false)}
          onSubmit={handleSave}
        />
      </>
    );
  }

  return (
    <div className="veveno-stack-lg">
      {seedCards}
      {dueToday.length > 0 ? (
        <section className="veveno-stack">
          <h2 className="veveno-subsection-title">오늘</h2>
          {dueToday.map((list) => (
            <VevenoCard
              key={list.templateId}
              title={`${list.title} · ${list.checkedCount}/${list.totalCount}`}
              action={
                isTodayComplete(list) ? (
                  <VevenoBadge variant="success">완료</VevenoBadge>
                ) : null
              }
            >
              <ChecklistItems
                list={list}
                onCheck={(itemId, checked) =>
                  void handleCheck(list.templateId, itemId, checked)
                }
              />
            </VevenoCard>
          ))}
        </section>
      ) : null}

      <section className="veveno-stack">
        <div className="veveno-toolbar">
          <h2 className="veveno-subsection-title">목록</h2>
          <div className="veveno-toolbar__actions">
            {owned ? (
              <VevenoButton size="sm" onClick={() => openCreate(false)}>
                가게
              </VevenoButton>
            ) : null}
            <VevenoButton size="sm" variant="secondary" onClick={() => openCreate(true)}>
              내 것
            </VevenoButton>
          </div>
        </div>
        {storeTemplates.map((template) => (
          <TemplateRow
            key={template.id}
            template={template}
            doneToday={doneTodayIds.has(template.id)}
            onEdit={openEdit}
            onDelete={handleDelete}
            onOpenToday={handleOpenToday}
          />
        ))}
        {personalTemplates.map((template) => (
          <TemplateRow
            key={template.id}
            template={template}
            doneToday={doneTodayIds.has(template.id)}
            onEdit={openEdit}
            onDelete={handleDelete}
            onOpenToday={handleOpenToday}
          />
        ))}
      </section>

      <ChecklistFormModal
        open={formOpen}
        owned={owned}
        editing={Boolean(editingId)}
        form={form}
        saving={saving}
        onChange={setForm}
        onClose={() => setFormOpen(false)}
        onSubmit={handleSave}
      />
      <VevenoModal
        open={Boolean(checkModal)}
        title={checkModal ? checkModal.title : '할 일'}
        onClose={() => setCheckModalId(null)}
      >
        {checkModal ? (
          <ChecklistItems
            list={checkModal}
            onCheck={(itemId, checked) =>
              void handleCheck(checkModal.templateId, itemId, checked)
            }
          />
        ) : null}
      </VevenoModal>
    </div>
  );
}

function SampleSeedCards({
  missingOpen,
  missingClose,
  onOpenOpen,
  onOpenClose,
}: {
  missingOpen: boolean;
  missingClose: boolean;
  onOpenOpen: () => void;
  onOpenClose: () => void;
}) {
  return (
    <div className="veveno-stack">
      {missingOpen ? (
        <VevenoCard title="오픈" onClick={onOpenOpen}>
          <p className="veveno-shell__meta">오픈 · {SAMPLE_OPEN.items.length}항목</p>
        </VevenoCard>
      ) : null}
      {missingClose ? (
        <VevenoCard title="마감" onClick={onOpenClose}>
          <p className="veveno-shell__meta">마감 · {SAMPLE_CLOSE.items.length}항목</p>
        </VevenoCard>
      ) : null}
    </div>
  );
}

function TemplateRow({
  template,
  doneToday,
  onEdit,
  onDelete,
  onOpenToday,
}: {
  template: VevenoChecklistTemplate;
  doneToday: boolean;
  onEdit: (template: VevenoChecklistTemplate) => void;
  onDelete: (template: VevenoChecklistTemplate) => void;
  onOpenToday: (templateId: string) => void;
}) {
  return (
    <VevenoCard
      title={`${template.personal ? '내 것 · ' : ''}${template.title}${template.enabled ? '' : ' (꺼짐)'}`}
      action={doneToday ? <VevenoBadge variant="success">완료</VevenoBadge> : null}
      onClick={template.canEdit ? () => onEdit(template) : undefined}
    >
      <p className="veveno-shell__meta">
        {TRIGGER_LABEL[template.triggerType]}
        {template.triggerType === 'CLOCK' && template.triggerTime
          ? ` ${template.triggerTime.slice(0, 5)}`
          : ''}
        {` · ${template.items.length}항목`}
      </p>
      <div className="veveno-toolbar__actions" style={{ marginTop: '0.75rem' }}>
        <VevenoButton
          size="sm"
          variant="secondary"
          onClick={(event) => {
            event.stopPropagation();
            onOpenToday(template.id);
          }}
        >
          열기
        </VevenoButton>
        {template.canEdit ? (
          <VevenoButton
            size="sm"
            variant="ghost"
            onClick={(event) => {
              event.stopPropagation();
              void onDelete(template);
            }}
          >
            삭제
          </VevenoButton>
        ) : null}
      </div>
    </VevenoCard>
  );
}

function ChecklistItems({
  list,
  onCheck,
}: {
  list: VevenoChecklistToday;
  onCheck: (itemId: number, checked: boolean) => void;
}) {
  return (
    <ul className="veveno-checklist">
      {list.items.map((item) => (
        <li key={item.id}>
          <label className="veveno-check">
            <input
              type="checkbox"
              checked={item.checked}
              onChange={(event) => onCheck(item.id, event.target.checked)}
            />
            <span>
              {item.body}
              {item.checked && item.checkedByNickname ? (
                <span className="veveno-shell__meta"> · {item.checkedByNickname}</span>
              ) : null}
            </span>
          </label>
        </li>
      ))}
    </ul>
  );
}

function ChecklistFormModal({
  open,
  owned,
  editing,
  form,
  saving,
  onChange,
  onClose,
  onSubmit,
}: {
  open: boolean;
  owned: boolean;
  editing: boolean;
  form: FormState;
  saving: boolean;
  onChange: (next: FormState) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent) => void;
}) {
  return (
    <VevenoModal open={open} title={editing ? '할 일 수정' : '할 일 만들기'} onClose={onClose}>
      <form className="veveno-form-stack" onSubmit={onSubmit}>
        <VevenoInput
          id="checklist-title"
          label="이름"
          value={form.title}
          onChange={(event) => onChange({ ...form, title: event.target.value })}
        />
        {owned && !editing ? (
          <div className="veveno-check-row">
            <label className="veveno-check">
              <input
                type="checkbox"
                checked={form.personal}
                onChange={(event) =>
                  onChange({ ...form, personal: event.target.checked })
                }
              />
              나만 보는 목록
            </label>
          </div>
        ) : null}
        <label className="veveno-field">
          <span>언제 열릴까요</span>
          <select
            value={form.triggerType}
            onChange={(event) => {
              const triggerType = event.target.value as VevenoChecklistTrigger;
              onChange({
                ...form,
                triggerType,
                interrupt: triggerType === 'SHIFT_START',
              });
            }}
          >
            <option value="CLOCK">매일(또는 요일) 시각</option>
            <option value="SHIFT_START">오픈</option>
            <option value="SHIFT_END">마감</option>
            <option value="MANUAL">직접 열기</option>
          </select>
        </label>
        {form.triggerType === 'CLOCK' ? (
          <>
            <VevenoTimeInput
              label="시각"
              value={form.triggerTime}
              onChange={(value) => onChange({ ...form, triggerTime: value })}
            />
            <div className="veveno-check-row">
              {DOWS.map((dow) => (
                <label key={dow.value} className="veveno-check">
                  <input
                    type="checkbox"
                    checked={form.triggerDows.includes(dow.value)}
                    onChange={(event) => {
                      const next = event.target.checked
                        ? [...form.triggerDows, dow.value]
                        : form.triggerDows.filter((value) => value !== dow.value);
                      onChange({ ...form, triggerDows: next });
                    }}
                  />
                  {dow.label}
                </label>
              ))}
            </div>
            <p className="veveno-shell__meta">요일을 안 고르면 매일입니다.</p>
          </>
        ) : null}
        {owned && !form.personal ? (
          <label className="veveno-field">
            <span>누가 보나요</span>
            <select
              value={form.audience}
              onChange={(event) =>
                onChange({
                  ...form,
                  audience: event.target.value as VevenoChecklistAudience,
                })
              }
            >
              <option value="ON_DUTY">그날 근무하는 사람</option>
              <option value="OWNER_ONLY">사장님만</option>
            </select>
          </label>
        ) : null}
        <div className="veveno-check-row">
          <label className="veveno-check">
            <input
              type="checkbox"
              checked={form.interrupt}
              onChange={(event) =>
                onChange({ ...form, interrupt: event.target.checked })
              }
            />
            들어오면 바로 열기
          </label>
        </div>
        <div className="veveno-check-row">
          <label className="veveno-check">
            <input
              type="checkbox"
              checked={form.enabled}
              onChange={(event) =>
                onChange({ ...form, enabled: event.target.checked })
              }
            />
            사용
          </label>
        </div>
        <div className="veveno-stack">
          <span className="veveno-field">항목</span>
          {form.items.map((item, index) => (
            <VevenoInput
              key={index}
              id={`checklist-item-${index}`}
              label={`항목 ${index + 1}`}
              value={item}
              onChange={(event) => {
                const next = [...form.items];
                next[index] = event.target.value;
                if (index === form.items.length - 1 && event.target.value.trim()) {
                  next.push('');
                }
                onChange({ ...form, items: next });
              }}
            />
          ))}
        </div>
        <VevenoButton type="submit" disabled={saving}>
          {saving ? '저장 중…' : '저장'}
        </VevenoButton>
      </form>
    </VevenoModal>
  );
}
