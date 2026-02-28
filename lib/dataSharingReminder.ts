import type { Notification } from '../types';

export const DATA_SHARE_REMINDER_PREFIX = 'gentle-data-share-';
const DATA_SHARE_REMINDER_STORAGE_KEY = 'finvantage_data_share_reminder_v1';
const DATA_SHARE_REMINDER_INTERVAL_MS = 14 * 24 * 60 * 60 * 1000;
const DATA_SHARE_DISMISSAL_LIMIT = 2;
const DATA_SHARE_MIN_MILESTONE_TX = 3;

type DataShareReminderState = {
  dismissals: number;
  lastPromptAt: string | null;
};

const clampDismissals = (value: unknown): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.min(DATA_SHARE_DISMISSAL_LIMIT, Math.floor(parsed)));
};

const normalizeState = (raw: unknown): DataShareReminderState => {
  if (!raw || typeof raw !== 'object') {
    return { dismissals: 0, lastPromptAt: null };
  }
  const record = raw as Record<string, unknown>;
  const lastPromptAt = typeof record.lastPromptAt === 'string' ? record.lastPromptAt : null;
  return {
    dismissals: clampDismissals(record.dismissals),
    lastPromptAt,
  };
};

const readState = (): DataShareReminderState => {
  if (typeof window === 'undefined') return { dismissals: 0, lastPromptAt: null };
  try {
    const saved = window.localStorage.getItem(DATA_SHARE_REMINDER_STORAGE_KEY);
    if (!saved) return { dismissals: 0, lastPromptAt: null };
    return normalizeState(JSON.parse(saved));
  } catch {
    return { dismissals: 0, lastPromptAt: null };
  }
};

const writeState = (state: DataShareReminderState) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(DATA_SHARE_REMINDER_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore persistence errors; reminder logic still works in-memory for this session.
  }
};

export const isDataShareReminderNotification = (id: string) =>
  id.startsWith(DATA_SHARE_REMINDER_PREFIX);

export const recordDataSharePrompt = () => {
  const current = readState();
  writeState({
    dismissals: current.dismissals,
    lastPromptAt: new Date().toISOString(),
  });
};

export const recordDataShareDismissal = (increment = 1) => {
  if (increment <= 0) return;
  const current = readState();
  writeState({
    dismissals: clampDismissals(current.dismissals + increment),
    lastPromptAt: current.lastPromptAt,
  });
};

export const shouldShowDataShareReminder = (params: {
  hasLocationData: boolean;
  transactionCount: number;
  notifications: Notification[];
}) => {
  const { hasLocationData, transactionCount, notifications } = params;

  if (hasLocationData) return false;
  if (transactionCount < DATA_SHARE_MIN_MILESTONE_TX) return false;
  if (notifications.some(note => isDataShareReminderNotification(note.id))) return false;

  const state = readState();
  if (state.dismissals >= DATA_SHARE_DISMISSAL_LIMIT) return false;
  if (!state.lastPromptAt) return true;

  const lastPromptMs = new Date(state.lastPromptAt).getTime();
  if (!Number.isFinite(lastPromptMs)) return true;
  return Date.now() - lastPromptMs >= DATA_SHARE_REMINDER_INTERVAL_MS;
};

export const buildDataShareReminderNotification = (): Notification => ({
  id: `${DATA_SHARE_REMINDER_PREFIX}${Date.now()}`,
  timestamp: new Date().toISOString(),
  title: 'Optional data can reduce manual work',
  message: 'It is completely okay to skip. If you add location, recommendations become more relevant and setup gets faster. You can disconnect anytime in Settings.',
  type: 'strategy',
  read: false,
});
