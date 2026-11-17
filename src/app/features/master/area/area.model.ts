// Fields confirmed LIVE (real backend, real account, 2026-11-14) against
// GET https://newoneapi.nestien.com/swagger/v1/swagger.json
// (AreaRequest/AreaGetRequest/AreaHistoryResponse schemas) and a real
// authenticated master/area/get call — same real entity area.config.ts
// already documents; AREA_CONFIG is kept and reused for the "View /
// History" dialog only (see area-list.component.ts's own comment for why
// Add/Edit needed a dedicated dialog instead, the same reasoning as
// Country/State/City/Postal Code Master's own rebuilds this session).
//
// CONFIRMED LIVE: like master/state/get, master/city/get and
// master/postalcode/get, master/area/get's own real response ALREADY
// denormalizes the full chain — countryCode/countryName/stateCode/
// stateName/cityCode/cityName/postalCodeCode/postalCodeName — directly
// onto the row. No separate lookup fetch needed for the list's own
// columns.
export interface AreaRow {
  areaId: string;
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
  areaCode?: string | null;
  areaName?: string | null;
  isActive: boolean;
}

export interface AreaSaveRequest {
  areaId?: string | null;
  countryId?: string | null;
  stateId?: string | null;
  cityId?: string | null;
  postalCodeId?: string | null;
  areaCode?: string | null;
  areaName?: string | null;
  remarks?: string | null;
}
