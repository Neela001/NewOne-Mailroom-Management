// Fields confirmed LIVE (real backend, real account, 2026-11-15) against
// GET https://newoneapi.nestien.com/swagger/v1/swagger.json
// (CourierModeRequest/CourierModeGetRequest/CourierModeHistoryGetRequest
// schemas) and a real authenticated master/couriermode/get call, plus a
// full create -> duplicate-probe -> edit -> history -> delete -> refetch
// cycle — same real entity couriermode.config.ts already documents;
// COURIERMODE_CONFIG is kept and reused ONLY for the "View / History"
// action (see couriermode-list.component.ts's own comment for why
// Add/Edit needed a dedicated dialog instead).
//
// CONFIRMED LIVE: master/couriermode/get's own real response is exactly
// {CourierModeId, ModeCode, ModeName, IsActive} — no extra fields, no
// resolveFrom lookups needed for the 3-column listing.
//
// CONFIRMED LIVE: the backend itself enforces Mode Code uniqueness — a
// real master/couriermode/add probe reusing an existing real modeCode was
// rejected with exactly "Duplicate mode code already exists." Never a
// frontend-only check invented here.
//
// CONFIRMED LIVE: Delete is a real soft delete — the deleted row persists
// with IsActive: false and remains reachable via a real
// master/couriermode/get {courierModeId, isActive: null} refetch.
//
// CONFIRMED LIVE: Remarks sent on both /add and /edit are genuinely
// persisted and visible on the matching master/couriermode/history/get
// row (a real probe's own "Initial create remark" and "Edited via
// investigation probe" values both came back verbatim on their own
// ADD/EDIT history rows) — same "write-only-per-action, never shown on
// the live /get row" pattern as every other entity's own Remarks field
// this session, confirmed here specifically via live history inspection
// rather than assumed.
export interface CourierModeRow {
  courierModeId: string;
  modeCode?: string | null;
  modeName?: string | null;
  isActive: boolean;
}

export interface CourierModeSaveRequest {
  courierModeId?: string | null;
  modeCode?: string | null;
  modeName?: string | null;
  remarks?: string | null;
}
