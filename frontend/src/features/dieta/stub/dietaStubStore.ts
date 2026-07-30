import type {
  DietaActivityLog,
  DietaBodyLog,
  DietaCheckInLog,
  DietaIntakeLog,
  DietaKetoEvent,
  DietaMealQueueDay,
  DietaProfile,
} from '../types';

const STORAGE_KEY = 'pbb-dieta-stub-v3';

export interface DietaStubState {
  profiles: Record<string, DietaProfile>;
  bodyLogs: Record<string, DietaBodyLog[]>;
  intakes: Record<string, DietaIntakeLog[]>;
  /** Simulates Redis dieta:mealq:{user}:{date} */
  mealQueues: Record<string, Record<string, DietaMealQueueDay>>;
  activities: Record<string, DietaActivityLog[]>;
  ketoEvents: Record<string, DietaKetoEvent[]>;
  checkIns: Record<string, DietaCheckInLog[]>;
}

function emptyState(): DietaStubState {
  return {
    profiles: {},
    bodyLogs: {},
    intakes: {},
    mealQueues: {},
    activities: {},
    ketoEvents: {},
    checkIns: {},
  };
}

export function loadDietaStub(): DietaStubState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return emptyState();
    }
    const parsed = JSON.parse(raw) as DietaStubState;
    return {
      profiles: parsed.profiles ?? {},
      bodyLogs: parsed.bodyLogs ?? {},
      intakes: parsed.intakes ?? {},
      mealQueues: parsed.mealQueues ?? {},
      activities: parsed.activities ?? {},
      ketoEvents: parsed.ketoEvents ?? {},
      checkIns: parsed.checkIns ?? {},
    };
  } catch {
    return emptyState();
  }
}

export function saveDietaStub(state: DietaStubState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}
