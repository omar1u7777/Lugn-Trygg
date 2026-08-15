/**
 * Single owner of the Sentry SDK for the whole app.
 *
 * Why this module exists
 * ----------------------
 * Error reporting used to be wired three different ways, two of which were
 * dead:
 *
 *  1. analytics.ts dynamically imported @sentry/react into a MODULE-LOCAL
 *     `Sentry` binding. Correct, but only reachable from analytics.ts.
 *  2. logger.ts and FeatureErrorBoundary.tsx both reported through
 *     `window.Sentry` — a global that NOTHING in this codebase ever assigns.
 *     src/global.d.ts described it as "CDN-loaded Sentry", but no CDN script
 *     exists. Every logger.error() and every caught React render crash was
 *     silently dropped.
 *  3. Calls made before the dynamic import resolved hit an undefined binding
 *     (a TypeError) or, after that was patched, a no-op that discarded the
 *     event. That window is page load in production — exactly when early
 *     errors happen and when a crisis report is most likely to be lost.
 *
 * This module is the one place that loads the SDK, and it QUEUES calls made
 * before the import resolves, replaying them onto the real client on arrival.
 *
 * It deliberately has NO imports. logger.ts imports this, and almost
 * everything imports logger.ts — any dependency here risks an import cycle
 * that would reintroduce the TDZ/undefined class of bug this replaces.
 */

export type SentryLevel = 'fatal' | 'error' | 'warning' | 'info' | 'debug';

export interface SentryUser {
  id?: string;
  email?: string;
  username?: string;
}

/**
 * The subset of @sentry/react this app actually calls. Note `captureMessage`
 * takes a full capture context (level + tags + contexts), not a bare level
 * string — the crisis call site passes tags and contexts.
 */
export interface SentryLike {
  init: (options?: Record<string, unknown>) => void;
  setUser: (user?: SentryUser | null) => void;
  captureException: (error?: Error, context?: Record<string, unknown>) => void;
  captureMessage: (message?: string, context?: unknown) => void;
  addBreadcrumb: (breadcrumb?: Record<string, unknown>) => void;
}

type QueuedCall =
  | { kind: 'setUser'; user: SentryUser | null | undefined }
  | { kind: 'captureException'; error: Error; context?: Record<string, unknown> }
  | { kind: 'captureMessage'; message: string; context?: unknown }
  | { kind: 'addBreadcrumb'; breadcrumb: Record<string, unknown> };

/**
 * Bounded so a boot-time error storm (or a DSN that never loads) cannot grow
 * this array without limit. Oldest calls are dropped first: the newest events
 * are the ones most likely to describe the failure still in progress.
 */
const MAX_QUEUED_CALLS = 50;

let client: SentryLike | null = null;
let queue: QueuedCall[] = [];
/** Set once the load attempt settles, successfully or not. */
let loadSettled = false;

const enqueue = (call: QueuedCall): void => {
  if (loadSettled && !client) {
    // No DSN, or the SDK failed to load — queueing would leak memory for
    // events that can never be delivered.
    return;
  }
  queue.push(call);
  if (queue.length > MAX_QUEUED_CALLS) {
    queue.splice(0, queue.length - MAX_QUEUED_CALLS);
  }
};

const replay = (target: SentryLike, call: QueuedCall): void => {
  switch (call.kind) {
    case 'setUser':
      target.setUser(call.user);
      break;
    case 'captureException':
      target.captureException(call.error, call.context);
      break;
    case 'captureMessage':
      target.captureMessage(call.message, call.context);
      break;
    case 'addBreadcrumb':
      target.addBreadcrumb(call.breadcrumb);
      break;
  }
};

const flushQueue = (target: SentryLike): void => {
  const pending = queue;
  queue = [];
  for (const call of pending) {
    try {
      replay(target, call);
    } catch {
      // A single malformed replayed event must never break the flush of the
      // rest, and must never surface to the user.
    }
  }
};

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN || '';

/** True when a DSN is configured, i.e. calls are worth queueing. */
export const isSentryConfigured = (): boolean => Boolean(SENTRY_DSN);

if (SENTRY_DSN) {
  // Dynamic import keeps the SDK out of the bundle when it is not configured.
  import('@sentry/react')
    .then((SentryModule) => {
      const loaded = SentryModule as unknown as SentryLike;
      loaded.init({
        dsn: SENTRY_DSN,
        environment: import.meta.env.MODE || 'production',
        tracesSampleRate: import.meta.env.PROD ? 0.1 : 1.0,
        replaysSessionSampleRate: 0,
        replaysOnErrorSampleRate: import.meta.env.PROD ? 1.0 : 0,
        enabled: import.meta.env.PROD,
      });
      client = loaded;
      loadSettled = true;
      flushQueue(loaded);
    })
    .catch(() => {
      // Nothing to report the failure TO — Sentry is what failed. Drop the
      // queue so it cannot pin memory for the life of the page.
      loadSettled = true;
      queue = [];
    });
} else {
  loadSettled = true;
}

export const setUser = (user?: SentryUser | null): void => {
  if (client) {
    client.setUser(user);
    return;
  }
  enqueue({ kind: 'setUser', user });
};

export const captureException = (
  error: Error,
  context?: Record<string, unknown>
): void => {
  if (client) {
    client.captureException(error, context);
    return;
  }
  enqueue({ kind: 'captureException', error, ...(context ? { context } : {}) });
};

export const captureMessage = (message: string, context?: unknown): void => {
  if (client) {
    client.captureMessage(message, context);
    return;
  }
  enqueue({ kind: 'captureMessage', message, ...(context !== undefined ? { context } : {}) });
};

export const addBreadcrumb = (breadcrumb: Record<string, unknown>): void => {
  if (client) {
    client.addBreadcrumb(breadcrumb);
    return;
  }
  enqueue({ kind: 'addBreadcrumb', breadcrumb });
};

/** Test seam: swap in a fake client and drain whatever was queued. */
export const __setSentryClientForTests = (fake: SentryLike | null): void => {
  client = fake;
  loadSettled = true;
  if (fake) {
    flushQueue(fake);
  } else {
    queue = [];
  }
};

/** Test seam: how many calls are waiting for the SDK. */
export const __getQueueLengthForTests = (): number => queue.length;

export default {
  setUser,
  captureException,
  captureMessage,
  addBreadcrumb,
  isSentryConfigured,
};
