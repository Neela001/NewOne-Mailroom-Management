// Fields confirmed LIVE (real backend, real account, 2026-11-14) against
// GET https://newoneapi.nestien.com/swagger/v1/swagger.json
// (RoomSaveRequest/RoomGetRequest schemas) and a real authenticated
// master/room/get call — same real entity room.config.ts already
// documents (RoomSaveRequest matches exactly); ROOM_CONFIG is kept and
// reused for the "View / History" dialog only (see
// room-list.component.ts's own comment for why Add/Edit needed a
// dedicated dialog instead, the same reasoning as every other location
// Master's own rebuild this session).
//
// CONFIRMED LIVE: master/room/get's own real response ALREADY
// denormalizes siteCode/siteName/buildingCode/buildingName/floorCode/
// floorName/wingCode/wingName/flatCode/flatName/flatNumber directly onto
// the row — no separate lookup fetch needed for the list's own columns.
//
// CONFIRMED LIVE: Room Code is genuinely auto-generated SERVER-SIDE, not
// a frontend-invented format — a real master/room/add call that omitted
// roomCode entirely returned a real generated value ("R-000002") in both
// the add response's own data[0].RoomCode and a subsequent master/room/get
// refetch of that same row. The Add/Edit dialog's own roomCode field is
// therefore always read-only: never sent on Add (left null so the
// backend generates it), and echoed back unchanged (never regenerated)
// on Edit.
//
// CONFIRMED LIVE: a Room under an active COMMERCIAL building saves
// successfully with flatId entirely omitted (confirmed null on refetch)
// — Flat really is optional, and the real "not applicable for Commercial"
// rule the task's own screenshot describes is reflected by simply never
// offering/sending a Flat for a non-RESIDENTIAL building, not a separate
// backend-rejected enum value (unlike Building Type's own RESIDENTIAL/
// COMMERCIAL-only Flat Master rule confirmed earlier this session).
export interface RoomRow {
  roomId: string;
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
  flatId?: string | null;
  flatCode?: string | null;
  flatName?: string | null;
  flatNumber?: string | null;
  roomCode?: string | null;
  roomName?: string | null;
  roomNumber?: string | null;
  isActive: boolean;
}

export interface RoomSaveRequest {
  roomId?: string | null;
  siteId?: string | null;
  buildingId?: string | null;
  floorId?: string | null;
  wingId?: string | null;
  flatId?: string | null;
  roomCode?: string | null;
  roomName?: string | null;
  roomNumber?: string | null;
  remarks?: string | null;
}
