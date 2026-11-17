// Fields confirmed LIVE (real backend, real account, 2026-11-14) against
// GET https://newoneapi.nestien.com/swagger/v1/swagger.json
// (FlatSaveRequest/FlatGetRequest/FlatHistoryResponse schemas) and a real
// authenticated master/flat/get call. The real Add/Edit schema is
// FlatSaveRequest (NOT "FlatRequest" like every other entity this
// session — confirmed by name search across all schemas), with fields
// {flatId, siteId, buildingId, floorId, wingId, flatCode, flatName,
// flatNumber, remarks} — flatNumber is real and was missing from the
// existing generic flat.config.ts's own formFields, same pattern as
// Floor Number this session. FLAT_CONFIG is kept and reused for the
// "View / History" dialog only (see flat-list.component.ts's own comment
// for why Add/Edit needed a dedicated dialog instead, the same reasoning
// as every other location Master's own rebuild this session).
//
// CONFIRMED LIVE: unlike Floor Number (a real int32), Flat Number's own
// real sample value is a quoted STRING ("1") — flatNumber is treated as a
// plain string by the backend, so it must never be coerced through a
// number input or parsed to a number (that would risk dropping a leading
// zero, same concern as postal codes — see postalcode.model.ts's own
// comment this session for the precedent).
//
// CONFIRMED LIVE: master/flat/get's own real response ALREADY
// denormalizes siteCode/siteName/buildingCode/buildingName/floorCode/
// floorName/wingCode/wingName directly onto the row — no separate lookup
// fetch needed for the list's own columns.
//
// CONFIRMED LIVE: the backend itself enforces "Only active RESIDENTIAL
// buildings can have Flats" — a real master/flat/add probe against a real
// wing under an active COMMERCIAL building was rejected with exactly that
// message. The Add/Edit dialog's own client-side Building eligibility
// filter (isActive && buildingType === 'RESIDENTIAL') mirrors this real
// backend rule rather than inventing or guessing it.
export interface FlatRow {
  flatId: string;
  siteId?: string | null;
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
  flatCode?: string | null;
  flatName?: string | null;
  flatNumber?: string | null;
  isActive: boolean;
}

export interface FlatSaveRequest {
  flatId?: string | null;
  siteId?: string | null;
  buildingId?: string | null;
  floorId?: string | null;
  wingId?: string | null;
  flatCode?: string | null;
  flatName?: string | null;
  flatNumber?: string | null;
  remarks?: string | null;
}
