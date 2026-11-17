// Fields confirmed LIVE (real backend, real account, 2026-11-14) against
// GET https://newoneapi.nestien.com/swagger/v1/swagger.json
// (BranchSaveRequest/BranchGetRequest/BranchLocationItem/
// BranchLocationOptionsGetRequest/BranchLocationGetRequest schemas) and
// real authenticated calls, including a full create -> fetch -> update ->
// fetch -> delete probe cycle. BRANCH_CONFIG (the existing generic
// config) is kept and reused for the "View / History" dialog only (see
// branch-list.component.ts's own comment for why Add/Edit needed a
// dedicated dialog instead — this is the single most involved Add/Edit
// workflow this session).
//
// CONFIRMED LIVE — the real API shape is NOT a standard add/edit pair:
//   - /api/v1/master/branch/save-with-locations — ONE combined endpoint
//     for both create (branchId null) and update (branchId set), which
//     also carries the Branch's own Building/Floor/Wing location
//     assignments as a `locations: BranchLocationItem[]` array in the
//     SAME call. There is no separate master/branch/add, master/branch/
//     edit, or master/branchlocation/* call involved — the existing
//     generic branchlocation.config.ts's own master/branchlocation/*
//     paths are a DIFFERENT, apparently unrelated/stale API family (a
//     real master/branchlocation/get probe returned 0 rows while the
//     real branch location data lives under master/branch/location/get
//     instead — see this file's own final-report writeup of this gap).
//   - /api/v1/master/branch/location-options/get — real, dedicated
//     endpoint for exactly this task's own "Branch Location Selection"
//     grid: given {siteId, branchId?}, it returns every real Building/
//     Floor/Wing combination that exists under that Site, each row
//     already denormalized with full Site/Building/Floor/Wing codes and
//     names, PLUS `isChecked`/`branchLocationId` reflecting whether that
//     exact combination is CURRENTLY assigned to the given branchId (and
//     all false/null when branchId is omitted, i.e. Add mode). This one
//     endpoint serves BOTH the Add-mode grid and the Edit-mode grid
//     (pre-checked) — no separate "restore saved selections" call is
//     needed.
//   - /api/v1/master/branch/location/get — a real, separate endpoint
//     returning a branch's own currently PERSISTED location rows (same
//     denormalized shape, without the isChecked/isAvailable flags) — used
//     here only to double-check the save-with-locations round trip during
//     investigation; the form itself relies on location-options/get.
//
// CONFIRMED LIVE — two real, non-obvious backend validation rules this
// task's own brief did not anticipate:
//   1. `locations` must contain AT LEAST ONE entry — a real
//      save-with-locations probe with `locations: []` was rejected with
//      "Select at least one Branch location." This directly contradicts
//      the task's own assumption that a "0 selected in loaded Site grids"
//      state should be independently saveable; it is enforced here as
//      real, confirmed client-side validation (at least one grid row must
//      be checked before Save is enabled), not an invented restriction.
//   2. Once `locations` is non-empty, the Branch's own countryId/stateId/
//      cityId/postalCodeId/areaId must ALSO be populated (a probe that
//      omitted them while sending a valid location was rejected with
//      "Branch location details are required.", even though none of
//      these fields appear in BranchSaveRequest's own JSON Schema
//      `required` list). This naturally falls out of the UI's own design
//      (Country/City are real selected dropdowns, and State/Postal Code/
//      Area are auto-derived from the selected Site's own denormalized
//      fields), so no extra handling was needed beyond always sending
//      what the user/Site selection already produced.
//
// CONFIRMED LIVE: CountryGetRequest has no companyId filter param of its
// own kind — Company selection does NOT affect Country eligibility
// server-side (this task's own "verify... before implementing that
// dependency" instruction, answered: no such relationship exists, so
// Country options are NOT filtered by the selected Company).
export interface BranchRow {
  branchId: string;
  companyId?: string | null;
  companyCode?: string | null;
  companyName?: string | null;
  branchCode?: string | null;
  branchName?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  addressLine3?: string | null;
  countryId?: string | null;
  countryCode?: string | null;
  countryName?: string | null;
  stateId?: string | null;
  stateCode?: string | null;
  stateName?: string | null;
  cityId?: string | null;
  cityCode?: string | null;
  cityName?: string | null;
  postalCodeId?: string | null;
  postalCodeCode?: string | null;
  postalCodeName?: string | null;
  areaId?: string | null;
  areaCode?: string | null;
  areaName?: string | null;
  phoneNo?: string | null;
  alternatePhoneNo?: string | null;
  emailId?: string | null;
  isActive: boolean;
}

// One row the "Branch Location Selection" grid can offer/track — a real
// Building/Floor/Wing combination under the selected Site, CONFIRMED LIVE
// to come back pre-flagged with the branch's own current assignment state
// when branchId is passed to location-options/get.
export interface BranchLocationOptionRow {
  siteId: string;
  siteCode?: string | null;
  siteName?: string | null;
  buildingId?: string | null;
  buildingCode?: string | null;
  buildingName?: string | null;
  floorId?: string | null;
  floorCode?: string | null;
  floorName?: string | null;
  wingId?: string | null;
  wingCode?: string | null;
  wingName?: string | null;
  branchLocationId?: string | null;
  isAvailable: boolean;
  isChecked: boolean;
}

export interface BranchLocationItem {
  siteId: string;
  buildingId?: string | null;
  floorId?: string | null;
  wingId?: string | null;
}

export interface BranchSaveRequest {
  branchId?: string | null;
  companyId: string;
  branchCode: string;
  branchName: string;
  addressLine1?: string | null;
  addressLine2?: string | null;
  addressLine3?: string | null;
  countryId?: string | null;
  stateId?: string | null;
  cityId?: string | null;
  postalCodeId?: string | null;
  areaId?: string | null;
  phoneNo?: string | null;
  alternatePhoneNo?: string | null;
  emailId?: string | null;
  remarks?: string | null;
  locations: BranchLocationItem[];
}
