// Fields confirmed LIVE (real backend, real account, 2026-11-14) against
// GET https://newoneapi.nestien.com/swagger/v1/swagger.json
// (SiteRequest/SiteGetRequest/SiteHistoryResponse schemas) and a real
// authenticated master/site/get call — same real entity site.config.ts
// already documents; SITE_CONFIG is kept and reused for the "View /
// History" dialog only (see site-list.component.ts's own comment for why
// Add/Edit needed a dedicated dialog instead, the same reasoning as
// Country/State/City/Postal Code/Area Master's own rebuilds this
// session).
//
// CONFIRMED LIVE: like master/state/get, master/city/get,
// master/postalcode/get and master/area/get, master/site/get's own real
// response ALREADY denormalizes the full chain — countryCode/countryName/
// stateCode/stateName/cityCode/cityName/postalCodeCode/postalCodeName/
// areaCode/areaName — directly onto the row. No separate lookup fetch
// needed for the list's own columns.
export interface SiteRow {
  siteId: string;
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
  siteCode?: string | null;
  siteName?: string | null;
  isActive: boolean;
}

export interface SiteSaveRequest {
  siteId?: string | null;
  countryId?: string | null;
  stateId?: string | null;
  cityId?: string | null;
  postalCodeId?: string | null;
  areaId?: string | null;
  siteCode?: string | null;
  siteName?: string | null;
  remarks?: string | null;
}
