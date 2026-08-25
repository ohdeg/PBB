import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { vevenoApi } from '../../api/vevenoApi';
import { getVevenoErrorMessage } from '../../features/veveno/i18n/error';
import { useTranslation } from '../../features/veveno/i18n/LanguageContext';
import { vevenoWeekdayLabels, type TranslateFn } from '../../features/veveno/i18n/translate';
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

function triggerLabel(type: VevenoChecklistTrigger, t: TranslateFn): string {
  switch (type) {
    case 'CLOCK':
      return t('checklists.triggerTime');
    case 'SHIFT_START':
      return t('checklists.triggerOpen');
    case 'SHIFT_END':
      return t('checklists.triggerClose');
    case 'MANUAL':
      return t('checklists.triggerManual');
    default:
      return type;
  }
}

function sampleOpen(t: TranslateFn): VevenoChecklistInput {
  return {
    title: t('checklists.sampleOpen'),
    triggerType: 'SHIFT_START',
    triggerTime: null,
    triggerDows: [],
    audience: 'ON_DUTY',
    interrupt: true,
    enabled: true,
    personal: false,
    items: [
      t('checklists.sampleOpen0'),
      t('checklists.sampleOpen1'),
      t('checklists.sampleOpen2'),
      t('checklists.sampleOpen3'),
      t('checklists.sampleOpen4'),
      t('checklists.sampleOpen5'),
      t('checklists.sampleOpen6'),
      t('checklists.sampleOpen7'),
    ],
  };
}

function sampleClose(t: TranslateFn): VevenoChecklistInput {
  return {
    title: t('checklists.sampleClose'),
    triggerType: 'SHIFT_END',
    triggerTime: null,
    triggerDows: [],
    audience: 'ON_DUTY',
    interrupt: false,
    enabled: true,
    personal: false,
    items: [
      t('checklists.sampleClose0'),
      t('checklists.sampleClose1'),
      t('checklists.sampleClose2'),
      t('checklists.sampleClose3'),
      t('checklists.sampleClose4'),
      t('checklists.sampleClose5'),
    ],
  };
}

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
  const t = useTranslation();
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
      onError(getVevenoErrorMessage(err, t('errors.failLoadChecklists'), t));
    });
  }, [loadTemplates, onError, t]);

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
      onError(t('checklists.nameItemsRequired'));
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
      onError(getVevenoErrorMessage(err, t('errors.failSave'), t));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (template: VevenoChecklistTemplate) => {
    if (!window.confirm(t('checklists.confirmDelete', { title: template.title }))) {
      return;
    }
    try {
      await vevenoApi.deleteChecklist(template.id);
      await loadTemplates();
    } catch (err: unknown) {
      onError(getVevenoErrorMessage(err, t('errors.failDelete'), t));
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
      onError(getVevenoErrorMessage(err, t('errors.failCheck'), t));
    }
  };

  const handleOpenToday = async (templateId: string) => {
    try {
      const { data } = await vevenoApi.openTodayChecklist(storeId, templateId);
      onTodayChange(data);
      setCheckModalId(templateId);
    } catch (err: unknown) {
      onError(getVevenoErrorMessage(err, t('errors.failOpenList'), t));
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
        onOpenOpen={() => openSample(sampleOpen(t))}
        onOpenClose={() => openSample(sampleClose(t))}
      />
    ) : null;

  if (templates.length === 0 && today.length === 0) {
    return (
      <>
        {owned ? (
          <div className="veveno-stack-lg">
            {seedCards}
            <VevenoButton variant="ghost" onClick={() => openCreate(false)}>
              {t('checklists.createCustom')}
            </VevenoButton>
          </div>
        ) : (
          <VevenoEmptyState
            title={t('checklists.emptyTitle')}
            body={t('checklists.emptyBody')}
            action={
              <VevenoButton onClick={() => openCreate(true)}>{t('checklists.createMine')}</VevenoButton>
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
          <h2 className="veveno-subsection-title">{t('checklists.today')}</h2>
          {dueToday.map((list) => (
            <VevenoCard
              key={list.templateId}
              title={`${list.title} · ${list.checkedCount}/${list.totalCount}`}
              action={
                isTodayComplete(list) ? (
                  <VevenoBadge variant="success">{t('checklists.done')}</VevenoBadge>
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
          <h2 className="veveno-subsection-title">{t('checklists.lists')}</h2>
          <div className="veveno-toolbar__actions">
            {owned ? (
              <VevenoButton size="sm" onClick={() => openCreate(false)}>
                {t('checklists.store')}
              </VevenoButton>
            ) : null}
            <VevenoButton size="sm" variant="secondary" onClick={() => openCreate(true)}>
              {t('checklists.mine')}
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
        title={checkModal ? checkModal.title : t('checklists.todo')}
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
  const t = useTranslation();
  const openSample = sampleOpen(t);
  const closeSample = sampleClose(t);
  return (
    <div className="veveno-stack">
      {missingOpen ? (
        <VevenoCard title={t('checklists.sampleOpen')} onClick={onOpenOpen}>
          <p className="veveno-shell__meta">
            {t('checklists.sampleMeta', {
              title: t('checklists.sampleOpen'),
              count: openSample.items.length,
            })}
          </p>
        </VevenoCard>
      ) : null}
      {missingClose ? (
        <VevenoCard title={t('checklists.sampleClose')} onClick={onOpenClose}>
          <p className="veveno-shell__meta">
            {t('checklists.sampleMeta', {
              title: t('checklists.sampleClose'),
              count: closeSample.items.length,
            })}
          </p>
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
  const t = useTranslation();
  return (
    <VevenoCard
      title={`${template.personal ? t('checklists.minePrefix') : ''}${template.title}${
        template.enabled ? '' : t('checklists.off')
      }`}
      action={doneToday ? <VevenoBadge variant="success">{t('checklists.done')}</VevenoBadge> : null}
      onClick={template.canEdit ? () => onEdit(template) : undefined}
    >
      <p className="veveno-shell__meta">
        {triggerLabel(template.triggerType, t)}
        {template.triggerType === 'CLOCK' && template.triggerTime
          ? ` ${template.triggerTime.slice(0, 5)}`
          : ''}
        {t('checklists.itemsCount', { count: template.items.length })}
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
          {t('common.open')}
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
            {t('common.delete')}
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
  const t = useTranslation();
  const dayLabels = vevenoWeekdayLabels(t);
  return (
    <VevenoModal
      open={open}
      title={editing ? t('checklists.editTitle') : t('checklists.createTitle')}
      onClose={onClose}
    >
      <form className="veveno-form-stack" onSubmit={onSubmit}>
        <VevenoInput
          id="checklist-title"
          label={t('common.name')}
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
              {t('checklists.personalOnly')}
            </label>
          </div>
        ) : null}
        <label className="veveno-field">
          <span>{t('checklists.whenOpen')}</span>
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
            <option value="CLOCK">{t('checklists.triggerClock')}</option>
            <option value="SHIFT_START">{t('checklists.triggerOpen')}</option>
            <option value="SHIFT_END">{t('checklists.triggerClose')}</option>
            <option value="MANUAL">{t('checklists.triggerManual')}</option>
          </select>
        </label>
        {form.triggerType === 'CLOCK' ? (
          <>
            <VevenoTimeInput
              label={t('checklists.triggerTime')}
              value={form.triggerTime}
              onChange={(value) => onChange({ ...form, triggerTime: value })}
            />
            <div className="veveno-check-row">
              {dayLabels.map((label, i) => {
                const value = i + 1;
                return (
                <label key={value} className="veveno-check">
                  <input
                    type="checkbox"
                    checked={form.triggerDows.includes(value)}
                    onChange={(event) => {
                      const next = event.target.checked
                        ? [...form.triggerDows, value]
                        : form.triggerDows.filter((dow) => dow !== value);
                      onChange({ ...form, triggerDows: next });
                    }}
                  />
                  {label}
                </label>
                );
              })}
            </div>
            <p className="veveno-shell__meta">{t('checklists.dowHint')}</p>
          </>
        ) : null}
        {owned && !form.personal ? (
          <label className="veveno-field">
            <span>{t('checklists.whoSees')}</span>
            <select
              value={form.audience}
              onChange={(event) =>
                onChange({
                  ...form,
                  audience: event.target.value as VevenoChecklistAudience,
                })
              }
            >
              <option value="ON_DUTY">{t('checklists.audienceOnDuty')}</option>
              <option value="OWNER_ONLY">{t('checklists.audienceOwner')}</option>
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
            {t('checklists.interrupt')}
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
            {t('checklists.enabled')}
          </label>
        </div>
        <div className="veveno-stack">
          <span className="veveno-field">{t('checklists.items')}</span>
          {form.items.map((item, index) => (
            <VevenoInput
              key={index}
              id={`checklist-item-${index}`}
              label={t('checklists.itemN', { n: index + 1 })}
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
          {saving ? t('common.saving') : t('common.save')}
        </VevenoButton>
      </form>
    </VevenoModal>
  );
}
