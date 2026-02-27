import { supabase } from './supabase';

type EventMetadata = Record<string, unknown>;

interface QueueEvent {
  eventName: string;
  source: string;
  metadata: EventMetadata;
  userId?: string | null;
  eventTime: string;
}

const MAX_BUFFER_SIZE = 25;
const FLUSH_INTERVAL_MS = 7_500;

let queue: QueueEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let flushing = false;
let listenersAttached = false;
let trackedUserId: string | null = null;
const sessionId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const sanitizeMetadata = (metadata?: EventMetadata): EventMetadata => {
  if (!metadata || typeof metadata !== 'object') return { sessionId };
  const safe: EventMetadata = { sessionId };

  for (const [key, value] of Object.entries(metadata)) {
    if (value == null) {
      safe[key] = value;
      continue;
    }

    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      safe[key] = value;
      continue;
    }

    if (Array.isArray(value)) {
      safe[key] = value.slice(0, 25);
      continue;
    }

    if (typeof value === 'object') {
      safe[key] = JSON.parse(JSON.stringify(value));
    }
  }

  return safe;
};

const resetTimer = () => {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
};

const ensureTimer = () => {
  resetTimer();
  flushTimer = setTimeout(() => {
    void flushActivityEvents();
  }, FLUSH_INTERVAL_MS);
};

const attachWindowListeners = () => {
  if (listenersAttached || typeof window === 'undefined') return;
  listenersAttached = true;

  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      void flushActivityEvents();
    }
  });

  window.addEventListener('beforeunload', () => {
    void flushActivityEvents();
  });
};

export const trackEvent = async (
  eventName: string,
  metadata?: EventMetadata,
  source = 'app',
  userId?: string | null
) => {
  const name = eventName.trim();
  if (!name) return;

  attachWindowListeners();

  queue.push({
    eventName: name,
    source,
    metadata: sanitizeMetadata(metadata),
    userId,
    eventTime: new Date().toISOString(),
  });

  if (queue.length >= MAX_BUFFER_SIZE) {
    void flushActivityEvents();
    return;
  }

  ensureTimer();
};

export const setUsageTrackingUserId = (userId?: string | null) => {
  trackedUserId = userId || null;
};

export const flushActivityEvents = async () => {
  if (flushing || queue.length === 0) return;

  flushing = true;
  resetTimer();

  try {
    const batch = queue.slice(0, MAX_BUFFER_SIZE);
    queue = queue.slice(MAX_BUFFER_SIZE);

    const payload = batch
      .map((item) => ({
        user_id: item.userId ?? trackedUserId,
        event_name: item.eventName,
        source: item.source,
        metadata: item.metadata,
        event_time: item.eventTime,
      }))
      .filter((row) => Boolean(row.user_id));

    if (payload.length > 0) {
      const { error } = await supabase.from('activity_events').insert(payload);
      if (error) {
        // Keep the queue lightweight and best-effort: restore only once for transient failures.
        queue = batch.concat(queue).slice(0, 250);
      }
    }
  } finally {
    flushing = false;
    if (queue.length > 0) ensureTimer();
  }
};
