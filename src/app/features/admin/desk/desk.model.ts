// Fields confirmed LIVE (real backend, real account, 2026-11-11) against
// GET https://newoneapi.nestien.com/swagger/v1/swagger.json and real
// authenticated POST calls. CORRECTING A PRIOR, NEVER-VERIFIED
// IMPLEMENTATION: the real desk endpoints live under `master/desk/*`, NOT
// `admin/desk/*` (confirmed: `admin/desk/save` and `admin/desk/get` do not
// exist in the live spec at all — only `admin/desk-user/*`, an unrelated
// feature already used by User Master). The real endpoints are:
//   - master/desk/get                  (DeskGetRequest -> untyped ObjectApiResponse,
//                                        confirmed PascalCase at runtime like every
//                                        other master entity's own /get)
//   - master/desk/save-with-locations  (DeskSaveWithLocationsRequest — ONE combined
//                                        add/edit endpoint; `locations` is REQUIRED,
//                                        minItems 1 — confirmed server-enforced,
//                                        not assumed, so location selection is
//                                        mandatory for every desk, MAIN or SUB)
//   - master/desk/delete                (DeskDeleteRequest)
//   - master/desk/history/get           (DeskIdRequest)
//   - master/desk/location-options/get  (DeskLocationOptionsRequest — the real
//                                        Building/Floor/Wing catalog for a given
//                                        Site, confirmed server-filtered by
//                                        siteId; passing the desk's own deskId
//                                        too flags its already-assigned
//                                        combinations via IsChecked=true, which is
//                                        how Edit restores existing selections —
//                                        confirmed live against a real desk with a
//                                        real saved location)
//   - master/desk/location/get           (DeskLocationGetRequest — a desk's own
//                                        already-saved locations, independent of
//                                        any site; used for the View dialog)
// Desk does NOT fit the generic MasterEntityConfig framework used for the
// other 31 entities (one combined save-with-locations endpoint, a 2-tab
// Add/Edit UI with site-dependent location loading, no flat formFields
// shape) — built as its own dedicated feature, same as before.
export type DeskType = 'MAIN' | 'SUB';

export interface DeskGetRequest {
  deskId?: string | null;
  parentDeskId?: string | null;
  cityId?: string | null;
  siteId?: string | null;
  deskType?: string | null;
  searchText?: string | null;
  isActive?: boolean | null;
}

export interface DeskRow {
  deskId: string;
  deskType?: DeskType | null;
  parentDeskId?: string | null;
  parentDeskCode?: string | null;
  parentDeskName?: string | null;
  deskCode?: string | null;
  deskName?: string | null;
  cityId: string;
  cityCode?: string | null;
  cityName?: string | null;
  siteId: string;
  siteCode?: string | null;
  siteName?: string | null;
  // Confirmed live: this is a literal email ADDRESS string (e.g.
  // "ops@nestien.com"), not a foreign-key id despite the field name —
  // matches one of master/email-setting's own emailAddress/emailName
  // values. Never an EmailSettingId guid in any real row seen.
  emailId?: string | null;
  emailSignature?: string | null;
  isActive: boolean;
}

// One row of the real Site -> Building -> Floor -> Wing combination
// catalog for a given site, from master/desk/location-options/get.
// IsChecked reflects whether the combination already belongs to the
// deskId passed in the request (omit deskId on Add — every row then comes
// back unchecked); IsAvailable gates whether the combination can be
// selected at all (confirmed real field, defensively respected even
// though every record seen so far has it true).
export interface DeskLocationOption {
  siteId: string;
  siteCode?: string | null;
  siteName?: string | null;
  buildingId: string;
  buildingCode?: string | null;
  buildingName?: string | null;
  floorId: string;
  floorCode?: string | null;
  floorName?: string | null;
  wingId: string;
  wingCode?: string | null;
  wingName?: string | null;
  deskLocationId?: string | null;
  isChecked: boolean;
  isAvailable: boolean;
}

export interface DeskLocationOptionsRequest {
  siteId: string;
  deskId?: string | null;
}

// A desk's own already-saved locations (master/desk/location/get), used by
// the View dialog — independent of the Add/Edit table's own site-scoped
// catalog above.
export interface DeskLocationRow {
  deskLocationId: string;
  deskId: string;
  deskCode?: string | null;
  deskName?: string | null;
  buildingId: string;
  buildingCode?: string | null;
  buildingName?: string | null;
  floorId: string;
  floorCode?: string | null;
  floorName?: string | null;
  wingId: string;
  wingCode?: string | null;
  wingName?: string | null;
  isActive: boolean;
}

// The exact shape the real save endpoint wants for each selected
// combination — just the 3 real ids, confirmed from
// DeskLocationSelection's own schema (no deskLocationId needed on save).
export interface DeskLocationSelection {
  buildingId: string;
  floorId: string;
  wingId: string;
}

export interface DeskSaveWithLocationsRequest {
  deskId?: string | null;
  deskType: DeskType;
  parentDeskId?: string | null;
  deskCode: string;
  deskName: string;
  cityId: string;
  siteId: string;
  emailId?: string | null;
  emailSignature?: string | null;
  remarks?: string | null;
  locations: DeskLocationSelection[];
}

export interface DeskDeleteRequest {
  deskId: string;
  remarks?: string | null;
}

export interface DeskHistoryRow {
  deskHistoryId: number;
  deskId: string;
  deskType?: DeskType | null;
  parentDeskId?: string | null;
  deskCode?: string | null;
  deskName?: string | null;
  cityId?: string | null;
  cityName?: string | null;
  siteId?: string | null;
  siteName?: string | null;
  emailId?: string | null;
  emailSignature?: string | null;
  isActive: boolean;
  actionType?: string | null;
  // Confirmed live: a raw admin/user userId guid, not a username (unlike
  // e.g. Email Setting's own history, whose actionBy already came back as
  // a plain username) — resolved to a real name via the same
  // resolveFrom/admin-user column-lookup mechanism every other entity's
  // history uses for a bare foreign-key id.
  actionBy?: string | null;
  actionDate?: string | null;
  remarks?: string | null;
}
