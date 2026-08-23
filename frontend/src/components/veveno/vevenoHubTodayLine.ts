import type { VevenoChecklistToday } from '../../types/veveno';

function progressLabel(list: VevenoChecklistToday): string {
  if (list.checkedCount <= 0) {
    return '아직';
  }
  if (list.totalCount > 0 && list.checkedCount >= list.totalCount) {
    return '완료';
  }
  return `${list.checkedCount}/${list.totalCount}`;
}

/** 허브 가게 카드용. due인 오픈·마감만. 없으면 undefined. */
export function hubTodayLine(lists: VevenoChecklistToday[]): string | undefined {
  const parts: string[] = [];
  const open = lists.find(
    (list) => list.due && list.triggerType === 'SHIFT_START',
  );
  const close = lists.find((list) => list.due && list.triggerType === 'SHIFT_END');
  if (open) {
    parts.push(`오픈 ${progressLabel(open)}`);
  }
  if (close) {
    parts.push(`마감 ${progressLabel(close)}`);
  }
  return parts.length > 0 ? parts.join(' · ') : undefined;
}
