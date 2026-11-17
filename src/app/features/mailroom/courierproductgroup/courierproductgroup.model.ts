// Fields confirmed LIVE (real backend, real account, 2026-11-15) against
// GET https://newoneapi.nestien.com/swagger/v1/swagger.json
// (CourierProductGroupRequest/GetRequest/HistoryGetRequest schemas) and a
// full create -> duplicate-probe (exact case AND different case) -> edit
// -> history -> delete -> refetch cycle — same real entity
// courierproductgroup.config.ts already documents; COURIERPRODUCTGROUP_CONFIG
// is kept and reused ONLY for the "View / History" action (see
// courierproductgroup-list.component.ts's own comment for why Add/Edit
// needed a dedicated dialog instead).
//
// CONFIRMED LIVE: master/courierproductgroup/get's own real response is
// exactly {CourierProductGroupId, Code, Name, IsActive} — no extra
// fields, no resolveFrom lookups needed for the 3-column listing.
//
// CONFIRMED LIVE: the backend itself enforces Code uniqueness, and that
// check is CASE-INSENSITIVE — a real probe reusing an existing real code
// in a DIFFERENT case (lowercase vs the original uppercase) was ALSO
// rejected with exactly "Duplicate product group code already exists."
// (this task's own explicit "Do not assume Code uniqueness rules or case
// sensitivity without checking the backend" instruction, now directly
// confirmed rather than assumed). Never a frontend-only check invented
// here.
//
// CONFIRMED LIVE: Delete is a real soft delete/deactivation — the real
// backend message is literally "Courier product group marked inactive."
// (not "deleted") and the row persists with IsActive: false, reachable
// via a real master/courierproductgroup/get {courierProductGroupId,
// isActive: null} refetch.
//
// CONFIRMED LIVE: Remarks sent on both /add and /edit are genuinely
// persisted and visible on the matching master/courierproductgroup/
// history/get row (a real probe's own "Initial create remark" and
// "Edited via investigation probe" values both came back verbatim on
// their own ADD/EDIT history rows) — same "write-only-per-action, never
// shown on the live /get row" pattern as every other entity's own
// Remarks field this session.
export interface CourierProductGroupRow {
  courierProductGroupId: string;
  code?: string | null;
  name?: string | null;
  isActive: boolean;
}

export interface CourierProductGroupSaveRequest {
  courierProductGroupId?: string | null;
  code?: string | null;
  name?: string | null;
  remarks?: string | null;
}
