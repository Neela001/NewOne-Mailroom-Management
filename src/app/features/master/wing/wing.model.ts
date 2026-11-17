// Fields confirmed LIVE (real backend, real account, 2026-11-14) against
// GET https://newoneapi.nestien.com/swagger/v1/swagger.json
// (WingRequest/WingGetRequest/WingHistoryResponse schemas) and a real
// authenticated master/wing/get call — WingRequest's own real fields are
// {wingId, siteId, buildingId, floorId, wingCode, wingName, remarks}, NOT
// just {floorId, wingCode, wingName, remarks} as the existing generic
// wing.config.ts's own formFields implied; WING_CONFIG is kept and reused
// for the "View / History" dialog only (see wing-list.component.ts's own
// comment for why Add/Edit needed a dedicated dialog instead, the same
// reasoning as Country/State/City/Postal Code/Area/Site/Building/Floor
// Master's own rebuilds this session).
//
// CONFIRMED LIVE: master/wing/get's own real response ALREADY
// denormalizes siteCode/siteName/buildingCode/buildingName/floorCode/
// floorName directly onto the row — no separate lookup fetch needed for
// the list's own columns.
export interface WingRow {
  wingId: string;
  siteId?: string | null;
  siteCode?: string | null;
  siteName?: string | null;
  buildingId?: string | null;
  buildingCode?: string | null;
  buildingName?: string | null;
  floorId?: string | null;
  floorCode?: string | null;
  floorName?: string | null;
  wingCode?: string | null;
  wingName?: string | null;
  isActive: boolean;
}

export interface WingSaveRequest {
  wingId?: string | null;
  siteId?: string | null;
  buildingId?: string | null;
  floorId?: string | null;
  wingCode?: string | null;
  wingName?: string | null;
  remarks?: string | null;
}
