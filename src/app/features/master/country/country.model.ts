// Fields confirmed LIVE (real backend, real account, 2026-11-12) against
// GET https://newoneapi.nestien.com/swagger/v1/swagger.json (CountryRequest/
// CountryGetRequest/CountryHistoryResponse schemas) and a real authenticated
// master/country/get + .../history/get call. apiBasePath "master/country"
// (POST .../master/country/{add,edit,delete,get,history/get}) — same real
// entity country.config.ts already documents; COUNTRY_CONFIG is kept and
// reused for the "View / History" dialog only (see country-list.component.ts's
// own comment for why Add/Edit needed a dedicated dialog instead).
//
// CONFIRMED LIVE: master/country/get's own real response (untyped,
// PascalCase at runtime like every other master entity's own /get) has NO
// "Remarks"/"Remarks"-like key at all, even though CountryRequest's own
// add/edit schema accepts one — e.g. the real India row's own history shows
// a genuine saved remarks value ("test") on its own EDIT history entry, but
// the CURRENT row returned by /get never carries a Remarks field. Same
// confirmed behavior as Upload Master's own remarks field this session —
// "Remarks" is a write-only-per-action changelog note (visible only via
// View / History), not persistent row state, so the Add/Edit dialog's own
// Remarks field always starts blank, including when editing.
export interface CountryRow {
  countryId: string;
  countryCode?: string | null;
  countryName?: string | null;
  isdCode?: string | null;
  hasState: boolean;
  hasCity: boolean;
  hasPostalCode: boolean;
  hasArea: boolean;
  stateLabel?: string | null;
  postalCodeLabel?: string | null;
  isActive: boolean;
}

export interface CountrySaveRequest {
  countryId?: string | null;
  countryCode?: string | null;
  countryName?: string | null;
  isdCode?: string | null;
  hasState: boolean;
  hasCity: boolean;
  hasPostalCode: boolean;
  hasArea: boolean;
  stateLabel?: string | null;
  postalCodeLabel?: string | null;
  remarks?: string | null;
}
