// Fields confirmed LIVE (real backend, real account, 2026-11-12) against
// GET https://newoneapi.nestien.com/swagger/v1/swagger.json (CityRequest/
// CityGetRequest/CityHistoryResponse schemas) and a real authenticated
// master/city/get call — same real entity city.config.ts already
// documents; CITY_CONFIG is kept and reused for the "View / History"
// dialog only (see city-list.component.ts's own comment for why Add/Edit
// needed a dedicated dialog instead, the same reasoning as Country/State
// Master's own rebuilds this session).
//
// CONFIRMED LIVE: like master/state/get, master/city/get's own real
// response ALREADY denormalizes countryCode/countryName/stateCode/
// stateName directly onto the row — no separate master/country/get or
// master/state/get lookup fetch needed for the list's own columns.
//
// CONFIRMED LIVE: stateId is genuinely nullable on CityRequest (the real
// add/edit schema) — a city whose own Country has Has State = false is
// never required to carry one, matching this task's own "do not send a
// fabricated State ID" rule.
export interface CityRow {
  cityId: string;
  countryId?: string | null;
  countryCode?: string | null;
  countryName?: string | null;
  stateId?: string | null;
  stateCode?: string | null;
  stateName?: string | null;
  cityCode?: string | null;
  cityName?: string | null;
  isActive: boolean;
}

export interface CitySaveRequest {
  cityId?: string | null;
  countryId?: string | null;
  stateId?: string | null;
  cityCode?: string | null;
  cityName?: string | null;
  remarks?: string | null;
}
