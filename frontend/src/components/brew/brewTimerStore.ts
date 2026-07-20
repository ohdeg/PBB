export type BrewTimerRunStatus = 'idle' | 'running' | 'paused' | 'done';

export interface BrewTimerStep {
  id: string;
  name: string;
  durationMs: number;
}

export interface BrewTimer {
  id: string;
  name: string;
  steps: BrewTimerStep[];
  currentStepIndex: number;
  remainingMs: number;
  status: BrewTimerRunStatus;
  endsAt: number | null;
  acknowledged: boolean;
}

interface BrewTimerState {
  timers: BrewTimer[];
}

type Listener = () => void;

const listeners = new Set<Listener>();

let state: BrewTimerState = {
  timers: [],
};

let tickId: number | null = null;

function emit(): void {
  listeners.forEach((listener) => listener());
}

function newId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

let audioCtx: AudioContext | null = null;
const completionAlarms = new Map<
  string,
  {
    timeoutId: number | null;
    oscillators: OscillatorNode[];
    count: number;
  }
>();
const COMPLETION_ALARM_REPEAT_COUNT = 10;
const COMPLETION_ALARM_INTERVAL_MS = 1500;

function getAudioContext(): AudioContext | null {
  if (audioCtx) return audioCtx;
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return null;
    audioCtx = new AudioCtx();
    return audioCtx;
  } catch {
    return null;
  }
}

/**
 * 브라우저 자동 재생 정책 때문에 오디오는 사용자 제스처(시작 버튼)에서
 * 미리 resume해 두어야 타이머 종료 시점(interval 콜백)에 소리가 난다.
 */
export function unlockTimerAudio(): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  if (ctx.state === 'suspended') {
    void ctx.resume();
  }
}

function beepAt(
  ctx: AudioContext,
  at: number,
  freq: number,
  durSec: number,
): OscillatorNode {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(0.18, at + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + durSec);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(at);
  osc.stop(at + durSec + 0.05);
  return osc;
}

function playBeep(kind: 'step' | 'finish'): OscillatorNode[] {
  try {
    const ctx = getAudioContext();
    if (!ctx) return [];
    if (ctx.state === 'suspended') {
      void ctx.resume();
    }
    const now = ctx.currentTime;
    if (kind === 'step') {
      return [beepAt(ctx, now, 880, 0.35)];
    }
    return [
      beepAt(ctx, now, 880, 0.28),
      beepAt(ctx, now + 0.36, 880, 0.28),
      beepAt(ctx, now + 0.72, 1174.66, 0.5),
    ];
  } catch {
    return [];
  }
}

function stopCompletionAlarm(id: string): void {
  const alarm = completionAlarms.get(id);
  if (!alarm) return;
  if (alarm.timeoutId !== null) {
    window.clearTimeout(alarm.timeoutId);
  }
  alarm.oscillators.forEach((oscillator) => {
    try {
      oscillator.stop();
    } catch {
      // oscillator may already have stopped
    }
  });
  completionAlarms.delete(id);
}

function startCompletionAlarm(id: string): void {
  stopCompletionAlarm(id);
  const alarm = {
    timeoutId: null as number | null,
    oscillators: [] as OscillatorNode[],
    count: 0,
  };
  completionAlarms.set(id, alarm);

  const ring = () => {
    const current = completionAlarms.get(id);
    if (!current) return;
    current.oscillators = playBeep('finish');
    current.count += 1;
    if (current.count >= COMPLETION_ALARM_REPEAT_COUNT) {
      current.timeoutId = window.setTimeout(() => {
        completionAlarms.delete(id);
      }, COMPLETION_ALARM_INTERVAL_MS);
      return;
    }
    current.timeoutId = window.setTimeout(ring, COMPLETION_ALARM_INTERVAL_MS);
  };

  ring();
}

function notify(
  title: string,
  body: string,
  kind: 'step' | 'finish' = 'finish',
  withSound = true,
): void {
  if (withSound) {
    playBeep(kind);
  }
  if (typeof Notification === 'undefined') return;
  if (Notification.permission === 'granted') {
    try {
      new Notification(title, { body });
    } catch {
      // ignore
    }
    return;
  }
  if (Notification.permission === 'default') {
    void Notification.requestPermission().then((permission) => {
      if (permission === 'granted') {
        try {
          new Notification(title, { body });
        } catch {
          // ignore
        }
      }
    });
  }
}

function anyRunning(): boolean {
  return state.timers.some((timer) => timer.status === 'running');
}

function ensureTick(): void {
  if (tickId !== null) return;
  if (!anyRunning()) return;
  tickId = window.setInterval(() => {
    syncFromClock();
  }, 250);
}

function stopTickIfIdle(): void {
  if (anyRunning()) return;
  if (tickId !== null) {
    window.clearInterval(tickId);
    tickId = null;
  }
}

function syncFromClock(): void {
  const now = Date.now();
  let changed = false;

  const nextTimers = state.timers.map((timer) => {
    if (timer.status !== 'running' || timer.endsAt == null) return timer;
    const remaining = Math.max(0, timer.endsAt - now);
    if (remaining === timer.remainingMs && remaining > 0) return timer;
    changed = true;

    if (remaining > 0) {
      return { ...timer, remainingMs: remaining };
    }

    const nextIndex = timer.currentStepIndex + 1;
    if (nextIndex >= timer.steps.length) {
      startCompletionAlarm(timer.id);
      notify('Veveno 타이머', `${timer.name || '타이머'} 완료`, 'finish', false);
      return {
        ...timer,
        remainingMs: 0,
        status: 'done' as const,
        endsAt: null,
        currentStepIndex: Math.max(0, timer.steps.length - 1),
        acknowledged: false,
      };
    }

    const nextStep = timer.steps[nextIndex];
    const currentStep = timer.steps[timer.currentStepIndex];
    notify(
      'Veveno 타이머',
      `${currentStep?.name || '단계'} 완료 → ${nextStep.name || '다음'} 시작`,
      'step',
    );
    return {
      ...timer,
      currentStepIndex: nextIndex,
      remainingMs: nextStep.durationMs,
      endsAt: now + nextStep.durationMs,
      status: 'running' as const,
    };
  });

  if (!changed) {
    stopTickIfIdle();
    return;
  }

  state = { timers: nextTimers };
  emit();
  stopTickIfIdle();
  ensureTick();
}

export function getBrewTimerState(): BrewTimerState {
  return state;
}

export function subscribeBrewTimers(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function addBrewTimer(
  name: string,
  steps: { name: string; durationMs: number }[],
): void {
  const normalized = steps
    .map((step, index) => ({
      id: newId(),
      name: step.name.trim() || `${index + 1}단계`,
      durationMs: Math.max(1000, Math.floor(step.durationMs)),
    }))
    .filter((step) => step.durationMs > 0);
  if (normalized.length === 0) return;

  state = {
    timers: [
      ...state.timers,
      {
        id: newId(),
        name: name.trim() || '타이머',
        steps: normalized,
        currentStepIndex: 0,
        remainingMs: normalized[0].durationMs,
        status: 'idle',
        endsAt: null,
        acknowledged: false,
      },
    ],
  };
  emit();
}

export function startBrewTimer(id: string): void {
  unlockTimerAudio();
  stopCompletionAlarm(id);
  const now = Date.now();
  state = {
    timers: state.timers.map((timer) => {
      if (timer.id !== id) return timer;
      if (timer.status === 'running' || timer.steps.length === 0) return timer;

      if (timer.status === 'done') {
        const first = timer.steps[0];
        return {
          ...timer,
          currentStepIndex: 0,
          remainingMs: first.durationMs,
          status: 'running',
          endsAt: now + first.durationMs,
          acknowledged: false,
        };
      }

      const remaining =
        timer.remainingMs > 0
          ? timer.remainingMs
          : (timer.steps[timer.currentStepIndex]?.durationMs ?? 0);
      return {
        ...timer,
        remainingMs: remaining,
        status: 'running',
        endsAt: now + remaining,
        acknowledged: false,
      };
    }),
  };
  emit();
  ensureTick();
}

export function pauseBrewTimer(id: string): void {
  syncFromClock();
  state = {
    timers: state.timers.map((timer) => {
      if (timer.id !== id || timer.status !== 'running') return timer;
      return {
        ...timer,
        status: 'paused',
        endsAt: null,
      };
    }),
  };
  emit();
  stopTickIfIdle();
}

export function resetBrewTimer(id: string): void {
  stopCompletionAlarm(id);
  state = {
    timers: state.timers.map((timer) => {
      if (timer.id !== id) return timer;
      const first = timer.steps[0];
      return {
        ...timer,
        currentStepIndex: 0,
        remainingMs: first?.durationMs ?? 0,
        status: 'idle',
        endsAt: null,
        acknowledged: false,
      };
    }),
  };
  emit();
  stopTickIfIdle();
}

export function removeBrewTimer(id: string): void {
  stopCompletionAlarm(id);
  state = {
    timers: state.timers.filter((timer) => timer.id !== id),
  };
  emit();
  stopTickIfIdle();
}

export function duplicateBrewTimer(id: string): void {
  const source = state.timers.find((timer) => timer.id === id);
  if (!source) return;

  const steps = source.steps.map((step) => ({
    id: newId(),
    name: step.name,
    durationMs: step.durationMs,
  }));
  if (steps.length === 0) return;

  state = {
    timers: [
      ...state.timers,
      {
        id: newId(),
        name: `${source.name} 복사`,
        steps,
        currentStepIndex: 0,
        remainingMs: steps[0].durationMs,
        status: 'idle',
        endsAt: null,
        acknowledged: false,
      },
    ],
  };
  emit();
}

export function updateBrewTimer(
  id: string,
  name: string,
  steps: { name: string; durationMs: number }[],
): void {
  stopCompletionAlarm(id);
  const normalized = steps
    .map((step, index) => ({
      id: newId(),
      name: step.name.trim() || `${index + 1}단계`,
      durationMs: Math.max(1000, Math.floor(step.durationMs)),
    }))
    .filter((step) => step.durationMs > 0);
  if (normalized.length === 0) return;

  state = {
    timers: state.timers.map((timer) => {
      if (timer.id !== id) return timer;
      return {
        ...timer,
        name: name.trim() || '타이머',
        steps: normalized,
        currentStepIndex: 0,
        remainingMs: normalized[0].durationMs,
        status: 'idle',
        endsAt: null,
        acknowledged: false,
      };
    }),
  };
  emit();
  stopTickIfIdle();
}

export function acknowledgeBrewTimer(id: string): void {
  stopCompletionAlarm(id);
  state = {
    timers: state.timers.map((timer) =>
      timer.id === id ? { ...timer, acknowledged: true } : timer,
    ),
  };
  emit();
}

export function formatTimerMs(ms: number): string {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
