// Investigation findings (LoginRequest/OtpStartRequest schemas, live spec at
// https://newoneapi.nestien.com/swagger/v1/swagger.json):
//
// - `deviceName`: plain optional string, no format/pattern. OtpStartRequest
//   caps it at 200 chars; LoginRequest declares no limit at all. No example
//   or description anywhere in the spec of what shape is expected.
// - `deviceId`: plain optional string, no format/pattern/example anywhere
//   in either schema — NOT a uuid-typed field (unlike captchaId/challengeId,
//   which the spec does mark `format: "uuid"`). The backend does not
//   document what it expects here.
// - IP address: searched every schema in the spec for any ip-related field.
//   The ONLY one that exists anywhere is `UserAuditEvent.ipAddress` — a
//   server-populated audit-log field (the backend captures the caller's own
//   IP from the HTTP connection). Neither LoginRequest nor OtpStartRequest
//   has an IP field at all, so one is never sent — not because it's hard to
//   get, but because the contract doesn't ask for it. A browser also has no
//   standard API for its own IP regardless (WebRTC/STUN leakage tricks
//   exist but are a privacy hack, not a documented API, and increasingly
//   blocked by browsers' own mDNS obfuscation) — moot here either way.
//
// What's genuinely implemented below, web-specific:
//
// getDeviceName(): a best-effort, honestly-labeled OS + browser string
// parsed from navigator.userAgent (e.g. "Windows - Chrome", "Android -
// Chrome"). This does NOT claim a form factor ("Laptop" vs "Desktop") —
// no browser API exposes that distinction, so it isn't fabricated.
//
// getOrCreateDeviceId(): since the backend documents no expected format,
// this uses the standard web pattern for "a stable identifier for this
// browser" — a random UUID generated once and persisted in localStorage, so
// it survives across sessions/tabs/logins from the same browser profile.
// This is NOT a hardware ID and does NOT claim to uniquely identify the
// laptop/device itself — it identifies this one browser profile, and will
// differ across different browsers, profiles, incognito windows, or after
// the user clears site data. That distinction matters and is not implied
// by the field name; it's the honest scope of what a browser can provide.
//
// Mobile-app compatibility: both functions are isolated here specifically
// because they're the WEB implementation of "device name"/"device id". A
// future mobile client (React Native/Capacitor/native) would supply its own
// values from its own platform APIs (e.g. a real OS-provided identifier)
// through its own equivalent of these two functions — nothing in
// AuthService, LoginRequest, or OtpStartRequest assumes a web-only source.
//
// BACKEND CLARIFICATION NEEDED: the spec gives no format/length guidance
// for deviceId (LoginRequest) and no description of what the backend does
// with either field (display-only in an audit/session list? used for
// trust/remember-this-device logic? something else?). The implementation
// below is a reasonable, non-fabricated default, not a confirmed contract —
// flagging this in case the backend expects a specific shape.

const DEVICE_ID_STORAGE_KEY = 'mailroom.deviceId';

export function getDeviceName(): string {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  if (!ua) return 'Unknown device';
  return `${detectOs(ua)} - ${detectBrowser(ua)}`.slice(0, 200);
}

export function getOrCreateDeviceId(): string {
  if (typeof localStorage === 'undefined') return '';
  try {
    const existing = localStorage.getItem(DEVICE_ID_STORAGE_KEY);
    if (existing) return existing;

    const generated = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : fallbackUuid();
    localStorage.setItem(DEVICE_ID_STORAGE_KEY, generated);
    return generated;
  } catch {
    // Storage unavailable (private browsing, disabled storage, etc.) — no
    // persisted identity is possible; omit rather than fabricate a
    // per-request throwaway value that wouldn't actually be "stable".
    return '';
  }
}

function detectOs(ua: string): string {
  if (/windows/i.test(ua)) return 'Windows';
  if (/android/i.test(ua)) return 'Android';
  if (/iphone|ipad|ipod/i.test(ua)) return 'iOS';
  if (/mac os x/i.test(ua)) return 'macOS';
  if (/cros/i.test(ua)) return 'ChromeOS';
  if (/linux/i.test(ua)) return 'Linux';
  return 'Unknown OS';
}

function detectBrowser(ua: string): string {
  if (/edg\//i.test(ua)) return 'Edge';
  if (/opr\/|opera/i.test(ua)) return 'Opera';
  if (/firefox\//i.test(ua)) return 'Firefox';
  if (/chrome\//i.test(ua) || /headlesschrome\//i.test(ua)) return 'Chrome';
  if (/safari\//i.test(ua)) return 'Safari';
  return 'Unknown browser';
}

function fallbackUuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
