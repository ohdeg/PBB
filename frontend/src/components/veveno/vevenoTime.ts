/** HH:mm (optional :ss) helpers for 12-hour schedule pickers. */

export function parseHHmm(value: string): { h24: number; minute: number } {
  const parts = value.split(':');
  const h24 = Math.min(23, Math.max(0, Number(parts[0]) || 0));
  const minute = Math.min(59, Math.max(0, Number(parts[1]) || 0));
  return { h24, minute };
}

export function formatHHmm(h24: number, minute: number): string {
  return `${String((h24 + 24) % 24).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export function hour12FromH24(h24: number): number {
  const mod = h24 % 12;
  return mod === 0 ? 12 : mod;
}

export function isPm(h24: number): boolean {
  return h24 >= 12;
}

/** 오전 11 → 12 는 오후 12(정오). 오후 11 → 12 는 오전 12(자정). */
export function applyHour12Change(prevH24: number, nextH12: number): number {
  if (nextH12 < 1 || nextH12 > 12) {
    return prevH24;
  }
  const prevH12 = hour12FromH24(prevH24);
  if (nextH12 === 12 && prevH12 === 11) {
    return (prevH24 + 1) % 24;
  }
  if (nextH12 === 11 && prevH12 === 12) {
    return (prevH24 + 23) % 24;
  }
  if (nextH12 === 1 && prevH12 === 12) {
    return (prevH24 + 1) % 24;
  }
  if (nextH12 === 12 && prevH12 === 1) {
    return (prevH24 + 23) % 24;
  }
  const pm = isPm(prevH24);
  if (nextH12 === 12) {
    return pm ? 12 : 0;
  }
  return pm ? nextH12 + 12 : nextH12;
}

export function stepHour(h24: number, delta: number): number {
  return (h24 + delta + 24) % 24;
}

export function withPeriod(h24: number, pm: boolean): number {
  const h12 = hour12FromH24(h24);
  if (h12 === 12) {
    return pm ? 12 : 0;
  }
  return pm ? h12 + 12 : h12;
}
