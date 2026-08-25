import type { TranslateFn } from '../../features/veveno/i18n/translate';
import type { VevenoChecklistToday } from '../../types/veveno';

function progressLabel(
  list: VevenoChecklistToday,
  pending: string,
  done: string,
): string {
  if (list.checkedCount <= 0) {
    return pending;
  }
  if (list.totalCount > 0 && list.checkedCount >= list.totalCount) {
    return done;
  }
  return `${list.checkedCount}/${list.totalCount}`;
}

/** 허브 가게 카드용. due인 오픈·마감만. 없으면 undefined. */
export function hubTodayLine(
  lists: VevenoChecklistToday[],
  t?: TranslateFn,
): string | undefined {
  const pending = t?.('hub.todayPending') ?? '아직';
  const done = t?.('hub.todayDone') ?? '완료';
  const parts: string[] = [];
  const open = lists.find(
    (list) => list.due && list.triggerType === 'SHIFT_START',
  );
  const close = lists.find((list) => list.due && list.triggerType === 'SHIFT_END');
  if (open) {
    const progress = progressLabel(open, pending, done);
    parts.push(t ? t('hub.todayOpen', { progress }) : `오픈 ${progress}`);
  }
  if (close) {
    const progress = progressLabel(close, pending, done);
    parts.push(t ? t('hub.todayClose', { progress }) : `마감 ${progress}`);
  }
  return parts.length > 0 ? parts.join(' · ') : undefined;
}
