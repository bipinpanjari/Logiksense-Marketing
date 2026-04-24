import * as Sentry from '@sentry/node';

let initialized = false;

/**
 * Initialise Sentry early in the process lifecycle. Safe to call multiple
 * times. No-ops if `SENTRY_DSN` is not configured so local dev stays clean.
 */
export function initSentry() {
  if (initialized) return;
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || 'development',
    release: process.env.GIT_SHA || process.env.RELEASE || undefined,
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.1'),
    sendDefaultPii: false,
    beforeSend(event) {
      if (event.request?.headers) {
        delete (event.request.headers as Record<string, unknown>).authorization;
        delete (event.request.headers as Record<string, unknown>).cookie;
      }
      return event;
    },
  });
  initialized = true;
}

export function captureException(err: unknown, extra?: Record<string, unknown>) {
  if (!initialized) return;
  Sentry.captureException(err, extra ? { extra } : undefined);
}
