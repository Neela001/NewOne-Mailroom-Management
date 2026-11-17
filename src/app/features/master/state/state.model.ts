// Fields confirmed LIVE (real backend, real account, 2026-11-12) against
// GET https://newoneapi.nestien.com/swagger/v1/swagger.json (StateRequest/
// StateGetRequest/StateHistoryResponse schemas) and a real authenticated
// master/state/get call — same real entity state.config.ts already
// documents; STATE_CONFIG is kept and reused for the "View / History"
// dialog only (see state-list.component.ts's own comment for why Add/Edit
// needed a dedicated dialog instead, the same reasoning as Country
// Master's own rebuild this session).
//
// CONFIRMED LIVE: unlike every other FK-referencing master entity this
// session (which only ever carries the bare id and needs a separate
// lookup fetch to resolve a display name — see column-lookup.util.ts's
// own comment), master/state/get's own real response ALREADY denormalizes
// countryCode/countryName directly onto the row — no separate
// master/country/get fetch needed for the list's own Country Code/Country
// Name columns.
export interface StateRow {
  stateId: string;
  countryId?: string | null;
  countryCode?: string | null;
  countryName?: string | null;
  stateCode?: string | null;
  stateName?: string | null;
  isActive: boolean;
}

export interface StateSaveRequest {
  stateId?: string | null;
  countryId?: string | null;
  stateCode?: string | null;
  stateName?: string | null;
  remarks?: string | null;
}
