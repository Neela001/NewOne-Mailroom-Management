// Fields confirmed LIVE (real backend, real account, 2026-11-14) against
// GET https://newoneapi.nestien.com/swagger/v1/swagger.json
// (BuildingRequest/BuildingGetRequest/BuildingHistoryResponse schemas)
// and a real authenticated master/building/get call — same real entity
// building.config.ts already documents; BUILDING_CONFIG is kept and
// reused for the "View / History" dialog only (see
// building-list.component.ts's own comment for why Add/Edit needed a
// dedicated dialog instead, the same reasoning as Country/State/City/
// Postal Code/Area/Site Master's own rebuilds this session).
//
// CONFIRMED LIVE: master/building/get's own real response ALREADY
// denormalizes siteCode/siteName directly onto the row — no separate
// lookup fetch needed for the list's own columns.
//
// CONFIRMED LIVE: BuildingRequest's own real buildingType is a plain
// nullable string with NO enum constraint in the live Swagger schema, and
// there is no separate BuildingType lookup/master entity anywhere in the
// API (confirmed — no schema name matching /buildingtype/i exists).
// However, the real backend DOES enforce a constraint server-side that
// Swagger's own metadata never exposed — CONFIRMED LIVE by a real
// master/building/add call returning
// `{ success: false, message: "Invalid Building Type. Allowed values are
// COMMERCIAL and RESIDENTIAL." }`. That real error message is the only
// authoritative source for these two values (see BUILDING_TYPE_OPTIONS in
// the Add/Edit dialog) — nothing here is hardcoded from assumption; see
// this module's own final report for the full writeup of this
// Swagger-vs-actual-behavior gap.
export const BUILDING_TYPE_OPTIONS = ['COMMERCIAL', 'RESIDENTIAL'] as const;
export interface BuildingRow {
  buildingId: string;
  siteId?: string | null;
  siteCode?: string | null;
  siteName?: string | null;
  buildingCode?: string | null;
  buildingName?: string | null;
  buildingType?: string | null;
  isActive: boolean;
}

export interface BuildingSaveRequest {
  buildingId?: string | null;
  siteId?: string | null;
  buildingCode?: string | null;
  buildingName?: string | null;
  buildingType?: string | null;
  remarks?: string | null;
}
