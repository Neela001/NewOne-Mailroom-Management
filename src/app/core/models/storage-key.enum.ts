// Deliberately not a port of the reference project's AES-encrypted storage
// scheme — that existed to protect an opaque session-cookie-like old-app
// token; this app's own token is a short-lived Bearer JWT the server itself
// already expires (see LoginResponse.expiresAtUtc), so plain sessionStorage
// is sufficient and avoids carrying crypto-js into a greenfield project for
// no real security gain.
export enum StorageKey {
  ACCESS_TOKEN = 'ACCESS_TOKEN',
  TOKEN_EXPIRES_AT = 'TOKEN_EXPIRES_AT',
  USER = 'USER',
  RIGHTS = 'RIGHTS',
  // The desk the user picked via Switch Desk, for THIS session only (see
  // desk-context.service.ts's own comment — there is no real server-side
  // "active desk" concept to persist this against). Cleared along with
  // everything else by AuthService.clearSession()'s own storage.clear().
  CURRENT_DESK_ID = 'CURRENT_DESK_ID',
}
