import { useMemo, useState } from 'react';
import {
  CONSENT_GROUP_LABEL,
  getActiveConsents,
  type ConsentDefinition,
  type ConsentGroup,
  type ConsentKey,
} from '../data/consents';

interface SignupConsentPanelProps {
  consents: Record<ConsentKey, boolean>;
  onChange: (key: ConsentKey, agreed: boolean) => void;
  onAgreeAllActive: (agreed: boolean) => void;
  disabled?: boolean;
}

const GROUP_ORDER: ConsentGroup[] = ['required', 'optional', 'special'];

export function SignupConsentPanel({
  consents,
  onChange,
  onAgreeAllActive,
  disabled = false,
}: SignupConsentPanelProps) {
  const active = useMemo(() => getActiveConsents(), []);
  const [openKey, setOpenKey] = useState<ConsentKey | null>(null);

  const allActiveChecked = active.every((item) => consents[item.key]);
  const openItem = openKey
    ? (active.find((item) => item.key === openKey) ?? null)
    : null;

  const grouped = GROUP_ORDER.map((group) => ({
    group,
    items: active.filter((item) => item.group === group),
  })).filter((entry) => entry.items.length > 0);

  return (
    <div className="consent-panel">
      <label className="consent-agree-all">
        <input
          type="checkbox"
          checked={allActiveChecked}
          disabled={disabled}
          onChange={(event) => onAgreeAllActive(event.target.checked)}
        />
        <span>전체 동의</span>
        <span className="consent-agree-all-hint">
          (선택 항목 포함 · 개별 해지 가능)
        </span>
      </label>

      {grouped.map(({ group, items }) => (
        <section key={group} className="consent-group" aria-label={CONSENT_GROUP_LABEL[group]}>
          <h3 className="consent-group-title">
            {CONSENT_GROUP_LABEL[group]}
            {group === 'required' ? (
              <span className="consent-badge is-required">필수</span>
            ) : (
              <span className="consent-badge is-optional">선택</span>
            )}
          </h3>
          {group === 'required' ? (
            <p className="consent-group-desc">
              동의하지 않으면 가입할 수 없습니다.
            </p>
          ) : (
            <p className="consent-group-desc">
              동의하지 않아도 회원가입이 가능합니다. 필수 동의와 묶여
              강제되지 않습니다.
            </p>
          )}
          <ul className="consent-list">
            {items.map((item) => (
              <ConsentRow
                key={item.key}
                item={item}
                checked={consents[item.key]}
                disabled={disabled}
                onChange={onChange}
                onOpen={() => setOpenKey(item.key)}
              />
            ))}
          </ul>
        </section>
      ))}

      {openItem ? (
        <ConsentDocumentModal
          item={openItem}
          onClose={() => setOpenKey(null)}
        />
      ) : null}
    </div>
  );
}

function ConsentRow({
  item,
  checked,
  disabled,
  onChange,
  onOpen,
}: {
  item: ConsentDefinition;
  checked: boolean;
  disabled: boolean;
  onChange: (key: ConsentKey, agreed: boolean) => void;
  onOpen: () => void;
}) {
  return (
    <li className="consent-row">
      <label className="consent-check">
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(event) => onChange(item.key, event.target.checked)}
        />
        <span>
          {item.required ? '[필수] ' : '[선택] '}
          {item.title}
        </span>
      </label>
      <button type="button" className="consent-view-btn" onClick={onOpen}>
        보기
      </button>
      <p className="consent-summary">{item.summary}</p>
    </li>
  );
}

function ConsentDocumentModal({
  item,
  onClose,
}: {
  item: ConsentDefinition;
  onClose: () => void;
}) {
  return (
    <div className="consent-modal" role="dialog" aria-modal="true" aria-labelledby="consent-modal-title">
      <button
        type="button"
        className="consent-modal-backdrop"
        aria-label="닫기"
        onClick={onClose}
      />
      <div className="consent-modal-panel">
        <header className="consent-modal-header">
          <h4 id="consent-modal-title">{item.title}</h4>
          <button type="button" className="consent-modal-close" onClick={onClose}>
            닫기
          </button>
        </header>
        <p className="consent-modal-version">버전 {item.version}</p>
        <pre className="consent-modal-body">{item.body}</pre>
      </div>
    </div>
  );
}
