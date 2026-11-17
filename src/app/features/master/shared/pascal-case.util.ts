// CONFIRMED LIVE FINDING (real backend, real account, 2026-10-16): every
// master/admin entity's own `/get` endpoint is documented in the spec as
// returning an untyped `ObjectApiResponse` (`data: object`, no schema —
// see api-response.model.ts's own comment), and that undocumented shape
// turns out, in practice, to be the raw C# object serialized in PascalCase
// (e.g. `CountryCode`, `CountryName`, and even `ISDCode` — the literal C#
// property name, acronym kept uppercase) — NOT the camelCase used
// everywhere else in this API (confirmed on the SAME request/response pair:
// `master/country/add`'s own request body is documented+accepted as
// camelCase `countryCode`, but `master/country/get`'s response for the same
// field comes back as `CountryCode`).
//
// This is NOT a global API quirk: `/history/get` and `admin/audit/get` and
// `admin/desk/get` all have a REAL typed response schema in the spec
// (CountryHistoryResponse[], UserAuditSearchResponse, DeskMasterGetResponse
// — not `ObjectApiResponse`), and were confirmed live to come back properly
// camelCase. The PascalCase behavior is specific to the untyped `/get`
// family only — apparently that code path serializes the object's raw CLR
// property names rather than going through the API's normal camelCase
// JSON policy. Normalizing is applied ONLY where this was confirmed
// (MasterApiService.get()), not blanket across every response.
//
// toCamelCase() is acronym-aware rather than a blind first-letter lowercase,
// specifically because of `ISDCode` -> `isdCode` (the config's own already-
// chosen field name, taken from the real Request schema): it lowercases the
// whole leading run of uppercase letters except the last one, which starts
// the next word. Applying it to an already-camelCase key is a safe no-op
// (no leading uppercase run to touch), so this can run unconditionally.
export function toCamelCase(key: string): string {
  const match = key.match(/^[A-Z]+/);
  if (!match) return key;
  const run = match[0];
  if (run.length === 1) return run.toLowerCase() + key.slice(1);
  const lowered = run.slice(0, -1).toLowerCase();
  const boundary = run.slice(-1);
  return lowered + boundary + key.slice(run.length);
}

export function normalizeRowKeys(row: Record<string, unknown>): Record<string, unknown> {
  const normalized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    normalized[toCamelCase(key)] = value;
  }
  return normalized;
}
