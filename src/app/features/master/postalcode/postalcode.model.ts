// Fields confirmed LIVE (real backend, real account, 2026-11-12) against
// GET https://newoneapi.nestien.com/swagger/v1/swagger.json
// (PostalcodeRequest/PostalcodeGetRequest/PostalCodeHistoryResponse
// schemas) and a real authenticated master/postalcode/get call — same
// real entity postalcode.config.ts already documents; POSTALCODE_CONFIG
// is kept and reused for the "View / History" dialog only (see
// postalcode-list.component.ts's own comment for why Add/Edit needed a
// dedicated dialog instead, the same reasoning as Country/State/City
// Master's own rebuilds this session).
//
// CONFIRMED LIVE: like master/state/get and master/city/get,
// master/postalcode/get's own real response ALREADY denormalizes
// countryCode/countryName/stateCode/stateName/cityCode/cityName directly
// onto the row — no separate lookup fetch needed for the list's own
// columns.
//
// CONFIRMED LIVE: postalCode is a plain nullable string on the real
// PostalcodeRequest — never numeric, so a leading-zero postal code is
// never at risk of being dropped as long as the UI never coerces it
// through a number input (this.form's own postalCode control uses a plain
// text app-input, never type="number").
export interface PostalCodeRow {
  postalCodeId: string;
  countryId?: string | null;
  countryCode?: string | null;
  countryName?: string | null;
  stateId?: string | null;
  stateCode?: string | null;
  stateName?: string | null;
  cityId?: string | null;
  cityCode?: string | null;
  cityName?: string | null;
  postalCode?: string | null;
  isActive: boolean;
}

export interface PostalCodeSaveRequest {
  postalCodeId?: string | null;
  countryId?: string | null;
  stateId?: string | null;
  cityId?: string | null;
  postalCode?: string | null;
  remarks?: string | null;
}
