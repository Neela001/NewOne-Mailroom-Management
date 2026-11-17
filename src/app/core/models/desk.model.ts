// `admin/desk-user/me/get` — the real desks assigned to the CURRENT logged-in
// user (confirmed live, 2026-11-06: real account "Manager" returns exactly
// the one desk it's actually assigned, Tirunelveli, with IsDefault: true).
// Like every other master/admin entity's own untyped `/get` response (see
// pascal-case.util.ts's own comment), this one comes back PascalCase at
// runtime despite having no documented response schema in the live spec —
// confirmed by direct authenticated call, not assumed from the pattern.
// Fields below are the camelCase shape after MasterApiService.get()'s own
// normalizeRowKeys() pass, which this service reuses rather than rolling a
// second normalization path.
export interface DeskAssignmentRow {
  deskUserId: string;
  userId: string;
  deskId: string;
  isActive: boolean;
  // The user's PERMANENT default desk (set by an admin via Desk User
  // Master's own DeskUserSaveRequest.defaultDeskId) — distinct from
  // whichever desk this session has temporarily switched to. Switching
  // desks in THIS app never changes this flag (see desk-context.service.ts's
  // own comment).
  isDefault: boolean;
  userName: string | null;
  deskCode: string | null;
  deskName: string | null;
  siteId: string | null;
  siteName: string | null;
  cityId: string | null;
  cityName: string | null;
  isAvailable: boolean;
}
