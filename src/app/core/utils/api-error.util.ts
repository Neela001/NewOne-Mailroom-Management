import { HttpErrorResponse } from '@angular/common/http';

const MAX_MESSAGE_LENGTH = 300;

// Reads the backend's own {success, message, data, traceId} envelope
// message out of a FAILED HTTP call. Angular's HttpClient still parses a
// JSON response body into `HttpErrorResponse.error` even on a non-2xx
// status — confirmed live against this backend: a 400 CAPTCHA-verification
// failure returns a normal JSON body, `{success:false, message:"CAPTCHA
// verification failed.", data:null, traceId:"..."}`, not an empty one — so
// callers that only branch on `success`/`next` and show a hardcoded string
// in `error:` are discarding a real message the backend already sent.
//
// Returns null — never a fabricated fallback — when there is no safe,
// usable message: a network failure with no response body at all, a body
// whose `message` isn't a string, an HTML error page (a proxy/dev-server
// failure, not an application message), or a suspiciously long body that
// is more likely a stack trace or debug payload than a user-facing string.
// Callers must render nothing (not a generic default) when this returns
// null — see login.component.ts's own usage.
export function extractApiErrorMessage(err: unknown): string | null {
  if (!(err instanceof HttpErrorResponse)) return null;

  const body = err.error as unknown;
  let candidate: unknown = null;

  if (body && typeof body === 'object' && typeof (body as { message?: unknown }).message === 'string') {
    candidate = (body as { message: string }).message;
  } else if (typeof body === 'string') {
    candidate = body;
  }

  if (typeof candidate !== 'string') return null;

  const trimmed = candidate.trim();
  if (!trimmed) return null;
  if (trimmed.length > MAX_MESSAGE_LENGTH) return null;
  if (/^<!doctype|^<html/i.test(trimmed)) return null;

  return trimmed;
}

// Same "real message or nothing" rule for a resolved-but-unsuccessful
// response (`{success: false, message: "..."}` on a 2xx status) — kept
// alongside extractApiErrorMessage so every auth failure path uses the
// identical rule instead of each component re-deciding what counts as a
// usable message.
export function usableMessage(message: string | null | undefined): string | null {
  if (typeof message !== 'string') return null;
  const trimmed = message.trim();
  return trimmed ? trimmed : null;
}
