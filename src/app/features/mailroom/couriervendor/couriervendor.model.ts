// Fields confirmed LIVE (real backend, real account, 2026-11-15) against
// GET https://newoneapi.nestien.com/swagger/v1/swagger.json (full schema
// read for CourierVendorRequest/GetRequest/WithContactsRequest/
// ContactDraft/ContactRequest/ContactGetRequest/DeskGetRequest) and
// real, READ-ONLY authenticated GET calls only — this task's own
// explicit "Do not insert, update or delete production data just for
// testing" instruction (its item 14) is stricter than earlier modules
// this session, so no throwaway create/duplicate/delete probes were run
// against real data during investigation. The one real existing vendor
// ("BlueDart") and its own real desk/contact/history rows were read, not
// mutated. COURIERVENDOR_CONFIG (couriervendor.config.ts) is kept and
// reused ONLY for the "View / History" action.
//
// CONFIRMED LIVE — this is NOT a plain add/edit/delete entity:
//   - POST master/couriervendor/options/get {} — a dedicated lookup
//     returning `{modes: CourierModeOptionRow[], desks:
//     CourierVendorDeskOptionRow[]}` in ONE call. This is THE real
//     source for both the Vendor Details tab's own Courier Mode dropdown
//     and the Desks tab's own "available desks" list — confirmed live to
//     include inactive rows too (a real "Test Desk One" row came back
//     with IsActive: false), so both lists are filtered to active-only
//     client-side, same as every other "eligible" list this session.
//   - POST master/couriervendor/save-with-contacts
//     (CourierVendorWithContactsRequest) — the one real combined save:
//     `{vendor: CourierVendorRequest, deskIds: string[], contacts:
//     CourierVendorContactDraft[], deletedContactIds: string[]}`.
//     CONFIRMED from the schema itself that desk assignment
//     (`deskIds`) and contact management (`contacts`/`deletedContactIds`)
//     use two DIFFERENT real semantics, not the same full-replace pattern
//     every other combined-save entity this session used:
//       - `deskIds` is the complete desired set of assigned desk ids
//         (full-replace, matching Employee/Branch/Desk's own established
//         pattern — assumed from the schema shape and this session's
//         consistent precedent; could not be round-trip-verified without
//         a disposable test vendor, which is exactly what this task's
//         own "Add vendor... Desk assignment..." section of its required
//         testing checklist creates and cleans up via the real UI, see
//         this module's own final report for that live confirmation).
//       - Contacts use an explicit DIFF model instead: `contacts` carries
//         every contact to keep/create/update (existing ones keep their
//         own `courierVendorContactId`, new ones omit it), and
//         `deletedContactIds` explicitly lists the ids of any
//         previously-saved contact the user removed this session. This
//         is NOT a full-replace array — confirmed directly from the
//         schema carrying both `contacts` AND a separate
//         `deletedContactIds` field side by side, which only makes sense
//         under a diff model (a full-replace design would need neither
//         a parallel deletion list).
//   - CONFIRMED LIVE, a genuine relationship the task's own brief warned
//     not to assume: every Contact belongs to exactly one of the
//     vendor's own assigned Desks — `CourierVendorContactDraft.deskId` is
//     a REQUIRED (non-nullable) uuid in the real schema, and a real
//     existing contact row (via master/couriervendor/contact/get) always
//     carries its own real DeskId/DeskCode/DeskName. The Contacts tab's
//     own "Add Contact" form must therefore offer a required Desk picker
//     scoped to THIS vendor's own currently-assigned desks (from the
//     Desks tab's own live state), not an unrelated system-wide desk list.
//   - master/couriervendor/desk/get {courierVendorId} and
//     master/couriervendor/contact/get {courierVendorId} are real,
//     dedicated READ endpoints — used for both the Add/Edit dialog's own
//     Edit-mode restore AND the listing's own separate "View Desks" /
//     "View Contacts" read-only actions. CONFIRMED no separate
//     `couriervendor/desk/add` or `/delete` endpoint exists (only
//     `/desk/get` and `/desk/history/get`) — desk assignment is only ever
//     changed through the combined save above.
//   - A full standalone CRUD family also exists for Contacts
//     (`contact/add`, `/edit`, `/delete`, `/get`, `/history/get`,
//     CourierVendorContactRequest, which additionally requires
//     `courierVendorId`) — NOT used by this dialog's own Save button,
//     since the real screenshot's own copy ("Click Save to apply vendor
//     and contact changes together") explicitly describes the combined
//     save-with-contacts workflow this dialog implements; the standalone
//     family is left alone as a lower-level API this task's own UI
//     doesn't need.
//   - CONFIRMED LIVE no typed CourierVendorHistoryResponse schema exists
//     (only CourierVendorHistoryGetRequest) — master/couriervendor/
//     history/get comes back raw PascalCase at runtime, same confirmed
//     root cause as Courier Mode/Email Setting/Desk/Upload Master this
//     session — COURIERVENDOR_CONFIG sets historyRowsArePascalCase: true.
//   - Vendor Type and Service Type are real, backend-persisted string
//     fields with NO documented enum in the schema and NO options list
//     in options/get's own response (unlike Courier Mode/Desks, which do
//     have one) — confirmed live values actually in use are exactly
//     {"BOTH","INBOUND_ONLY"} for Vendor Type and {"DOMESTIC","BOTH"} for
//     Service Type (one real history row also shows ServiceType: null,
//     i.e. genuinely optional at the time, though the task's own
//     screenshot shows it as a required dropdown — implemented as
//     UI-required per the brief). These two option lists are therefore
//     built from CONFIRMED REAL VALUES actually observed in production
//     data, not a documented backend enum and not invented — flagged
//     explicitly in the final report as a gap: if the backend ever adds
//     an options source for these two fields (the way it already has one
//     for Modes/Desks), the frontend should switch to consuming it
//     instead of this static, data-derived list.
export interface CourierVendorRow {
  courierVendorId: string;
  courierModeId?: string | null;
  modeCode?: string | null;
  modeName?: string | null;
  vendorCode?: string | null;
  vendorName?: string | null;
  vendorType?: string | null;
  serviceType?: string | null;
  trackingUrl?: string | null;
  isActive: boolean;
}

export interface CourierModeOptionRow {
  courierModeId: string;
  modeCode?: string | null;
  modeName?: string | null;
  isActive: boolean;
}

export interface CourierVendorDeskOptionRow {
  deskId: string;
  deskCode?: string | null;
  deskName?: string | null;
  siteName?: string | null;
  cityName?: string | null;
  isActive: boolean;
}

export interface CourierVendorOptionsResponse {
  modes: CourierModeOptionRow[];
  desks: CourierVendorDeskOptionRow[];
}

export interface CourierVendorDeskAssignmentRow {
  courierVendorDeskId: string;
  courierVendorId: string;
  deskId: string;
  deskCode?: string | null;
  deskName?: string | null;
  siteName?: string | null;
  cityName?: string | null;
  isActive: boolean;
  isAvailable?: boolean | null;
}

export interface CourierVendorContactRow {
  courierVendorContactId: string;
  courierVendorId: string;
  vendorCode?: string | null;
  vendorName?: string | null;
  deskId: string;
  deskCode?: string | null;
  deskName?: string | null;
  contactPerson?: string | null;
  contactNo?: string | null;
  emailId?: string | null;
  isActive: boolean;
}

export interface CourierVendorContactDraft {
  courierVendorContactId?: string | null;
  deskId: string;
  contactPerson?: string | null;
  contactNo?: string | null;
  emailId?: string | null;
}

export interface CourierVendorFieldsRequest {
  courierVendorId?: string | null;
  courierModeId?: string | null;
  vendorCode?: string | null;
  vendorName?: string | null;
  vendorType?: string | null;
  serviceType?: string | null;
  trackingUrl?: string | null;
  remarks?: string | null;
}

export interface CourierVendorSaveRequest {
  vendor: CourierVendorFieldsRequest;
  deskIds: string[];
  contacts: CourierVendorContactDraft[];
  deletedContactIds: string[];
}
