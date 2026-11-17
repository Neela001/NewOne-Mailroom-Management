// Fields confirmed LIVE (real backend, real account, 2026-11-14) against
// GET https://newoneapi.nestien.com/swagger/v1/swagger.json
// (DesignationRequest/DesignationGetRequest/DesignationHistoryResponse
// schemas) and a real authenticated master/designation/get call, plus a
// full set of live create -> refetch -> delete probes specifically for
// designationLevel — same real entity designation.config.ts already
// documents; DESIGNATION_CONFIG is kept and reused for the "View /
// History" dialog only (see designation-list.component.ts's own comment
// for why Add/Edit needed a dedicated dialog instead).
//
// CONFIRMED LIVE: master/designation/get's own real response ALREADY
// denormalizes companyCode/companyName directly onto the row — no
// separate lookup fetch needed for the list's own column.
//
// CONFIRMED LIVE — the full designationLevel / "Specify level" semantics
// this task's own brief asks to verify rather than assume:
//   - The real DesignationRequest schema has designationLevel as a plain
//     nullable int32 — {type: "integer", format: "int32", nullable:
//     true}. There is NO separate "specify level"/"isLevelSpecified"
//     boolean field anywhere in the real schema. "Specify level" is
//     therefore a pure UI convenience, not a backend concept — its only
//     job is deciding whether the Add/Edit dialog sends a real number or
//     null for designationLevel.
//   - Level is genuinely OPTIONAL: a real add call that omitted
//     designationLevel entirely succeeded and the row refetched with
//     designationLevel: null.
//   - Negative values ARE accepted and persisted exactly as entered (a
//     real -1 round-tripped through add+refetch unchanged) — no backend
//     minimum.
//   - Decimal values are REJECTED, but by a hard JSON type error (not a
//     business-rule message) — "The JSON value could not be converted to
//     System.Nullable`1[System.Int32]" — confirming this is a genuine
//     integer field; the Add/Edit dialog's own Level input must never
//     allow a decimal value to be submitted.
//   - 0 is a real, valid, persisted value — CONFIRMED DISTINCT from null
//     (a real add with designationLevel: 0 refetched back as exactly 0,
//     not null). This is exactly why "Specify level" must be tracked as
//     its own real checkbox state, never inferred from whether the
//     number happens to be 0 — see this task's own explicit "Do not
//     silently convert an unspecified level into 0 unless that is the
//     actual backend rule" instruction, now confirmed it is NOT the rule.
//   - No hierarchy/sorting/employee-assignment behavior exists anywhere
//     in the real schema for this field — nothing invented here.
export interface DesignationRow {
  designationId: string;
  companyId?: string | null;
  companyCode?: string | null;
  companyName?: string | null;
  designationCode?: string | null;
  designationName?: string | null;
  designationLevel?: number | null;
  isActive: boolean;
}

export interface DesignationSaveRequest {
  designationId?: string | null;
  companyId?: string | null;
  designationCode?: string | null;
  designationName?: string | null;
  designationLevel?: number | null;
  remarks?: string | null;
}
