// Fields confirmed LIVE (real backend, real account, 2026-11-14) against
// GET https://newoneapi.nestien.com/swagger/v1/swagger.json
// (FloorRequest/FloorGetRequest/FloorHistoryResponse schemas) and a real
// authenticated master/floor/get call — same real entity floor.config.ts
// already documents (though its own formFields never included
// floorNumber — CONFIRMED LIVE it is a real, separate nullable int32
// field: `{ type: "integer", format: "int32", nullable: true }`, not
// something to invent here); FLOOR_CONFIG is kept and reused for the
// "View / History" dialog only (see floor-list.component.ts's own
// comment for why Add/Edit needed a dedicated dialog instead, the same
// reasoning as Country/State/City/Postal Code/Area/Site/Building Master's
// own rebuilds this session).
//
// CONFIRMED LIVE: master/floor/get's own real response ALREADY
// denormalizes siteCode/siteName/buildingCode/buildingName directly onto
// the row — no separate lookup fetch needed for the list's own columns.
export interface FloorRow {
  floorId: string;
  siteId?: string | null;
  siteCode?: string | null;
  siteName?: string | null;
  buildingId?: string | null;
  buildingCode?: string | null;
  buildingName?: string | null;
  floorCode?: string | null;
  floorName?: string | null;
  // Nullable int32 — 0 and negative values are real, valid floor numbers
  // (basement levels), never to be treated as "empty". See the Add/Edit
  // dialog's own comment for the handling this requires.
  floorNumber?: number | null;
  isActive: boolean;
}

export interface FloorSaveRequest {
  floorId?: string | null;
  siteId?: string | null;
  buildingId?: string | null;
  floorCode?: string | null;
  floorName?: string | null;
  floorNumber?: number | null;
  remarks?: string | null;
}
