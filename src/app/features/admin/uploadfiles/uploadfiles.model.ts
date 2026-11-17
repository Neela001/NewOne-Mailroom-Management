// Fields confirmed LIVE (real backend, real account, 2026-11-12) against
// GET https://newoneapi.nestien.com/swagger/v1/swagger.json and real
// authenticated POST/GET calls. The real endpoints (tag "UploadQueue"
// unless noted):
//   - admin/uploads/definitions/get  (no request body -> CONFIRMED LIVE
//                                     returns ONLY the active Upload Master
//                                     definitions — the inactive
//                                     "ZZTEST Upload Definition" test row
//                                     from this session was correctly
//                                     excluded. Same row shape as
//                                     UploadDefinitionRow in
//                                     uploadmaster.model.ts, PascalCase at
//                                     runtime like every other untyped
//                                     `/get`.)
//   - admin/uploads/get              (UploadQueueGetRequest{uploadId?} ->
//                                     untyped ObjectApiResponse. This is the
//                                     endpoint the Windows reference's own
//                                     simpler listing — no search box, no
//                                     status filter row, just
//                                     Refresh/New upload/Download result/
//                                     Download failed/View history — maps
//                                     onto; a richer, separately-filterable
//                                     sibling exists at
//                                     admin/upload-master/uploads/get
//                                     (UploadJobGetRequest{uploadId?,
//                                     searchText?, currentStatus?,
//                                     pageSize}) but isn't used here since
//                                     this screen has no search/status
//                                     controls in the reference UI.
//                                     CONFIRMED LIVE: currently returns
//                                     `data: []` — no one has ever run an
//                                     Upload Files job on this real account,
//                                     so no real example row exists to
//                                     inspect this session (see
//                                     UploadJobRow's own comment below for
//                                     how this was handled).
//   - admin/uploads/history/get      (UploadJobHistoryGetRequest{uploadId}
//                                     (required, unlike the nullable one on
//                                     admin/uploads/get) -> untyped
//                                     ObjectApiResponse, same "no real rows
//                                     exist yet" situation.)
//   - admin/uploads/contexts/get     (UploadQueueContextRequest{definitionId}
//                                     -> CONFIRMED LIVE returns `data: []`
//                                     for both real active definitions,
//                                     since neither currently declares a
//                                     non-null ContextParameterName on
//                                     Upload Master. Wired honestly: the
//                                     New Excel Upload popup only shows a
//                                     Context dropdown when the selected
//                                     definition's own contextParameterName
//                                     is non-null — never hardcoded.)
//   - admin/uploads/submit           (multipart/form-data:
//                                     {DefinitionId, ContextId?, RequestId,
//                                     File} -> untyped ObjectApiResponse.
//                                     RequestId is a client-generated GUID,
//                                     used for duplicate-submission
//                                     prevention on the backend side —
//                                     generated fresh per submit attempt,
//                                     not reused across retries of the same
//                                     logical click.)
//   - admin/uploads/template/{definitionId}  (GET, no request body ->
//                                     CONFIRMED LIVE: real binary .xlsx,
//                                     content-type
//                                     application/vnd.openxmlformats-
//                                     officedocument.spreadsheetml.sheet,
//                                     real Content-Disposition with the
//                                     real filename e.g.
//                                     "Country Vertical Data.xlsx" — BUT
//                                     CONFIRMED LIVE the response does NOT
//                                     send Access-Control-Expose-Headers,
//                                     so `fetch()`/XHR in the browser
//                                     cannot read Content-Disposition's
//                                     filename (the Fetch spec's default
//                                     CORS-safelisted response headers
//                                     don't include it). The frontend
//                                     reconstructs the filename as
//                                     `${definition.uploadName}.xlsx`,
//                                     which was confirmed to exactly match
//                                     the server's own real filename for
//                                     "Country Vertical Data".)
//   - admin/uploads/{uploadId}/result  (GET, query `failedOnly:boolean` ->
//                                     CONFIRMED LIVE in the spec as the
//                                     SAME endpoint for both "Download
//                                     result" (failedOnly=false) and
//                                     "Download failed" (failedOnly=true) —
//                                     not two separate endpoints. Real
//                                     response shape/content-type not
//                                     inspected this session — doing so
//                                     would require actually running
//                                     admin/uploads/submit against a real
//                                     upload definition, which invokes a
//                                     real stored procedure against
//                                     production master data; the user was
//                                     asked and chose NOT to do that this
//                                     session (see UploadJobRow's own
//                                     comment).)
//   - admin/uploads/{uploadId}/original (GET -> downloads the originally
//                                     submitted Excel file. Not surfaced in
//                                     this UI — the task's own reference
//                                     spec only asks for Download
//                                     result/Download failed, not the
//                                     original file, so no control was
//                                     added for it; it exists and could be
//                                     wired later if ever requested.)
//   - admin/upload-master/uploads/history/get (tag "UploadMaster", same
//                                     UploadJobHistoryGetRequest{uploadId}
//                                     shape — a documented equivalent at a
//                                     different route prefix. Not used
//                                     here; admin/uploads/history/get was
//                                     chosen instead for consistency with
//                                     the listing endpoint under the same
//                                     uploads/* prefix.)
export interface UploadFileDefinitionRow {
  uploadDefinitionId: string;
  uploadName?: string | null;
  procedureSchema?: string | null;
  procedureName?: string | null;
  xmlParameterName?: string | null;
  contextParameterName?: string | null;
  contextType?: string | null;
  isActive: boolean;
}

export interface UploadContextOption {
  contextId: string;
  label?: string | null;
}

// UNCONFIRMED FIELD NAMES — flagged explicitly rather than silently
// guessed. admin/uploads/get and admin/uploads/history/get both CONFIRMED
// LIVE return `data: []` on this real account (no Upload Files job has
// ever been run), so there is no real example row to inspect this session.
// The user was asked whether to run a real test submission to learn the
// true schema and explicitly chose NOT to (a real submit invokes a real
// stored procedure against production master data with no documented
// dry-run/rollback path). The field names below are therefore a best-
// effort mapping built from: (1) the task's own stated column list
// (Upload no./Upload name/Uploaded at/Total/Success/Failed/Status/
// Remarks), (2) this backend's own established PascalCase-at-runtime
// convention for untyped `/get` responses (same as every other entity
// this session), and (3) the one piece of REAL confirmed evidence
// available — UploadJobGetRequest's own filter field is literally named
// `currentStatus`, strongly suggesting the row's own status field uses
// that same name (filter names mirroring their own row's field name is
// the established convention elsewhere in this API, e.g. `isActive`).
// `mapUploadJobRow()` below reads several plausible aliases per field
// defensively (same tolerant-aliasing approach already used for Excel
// header matching in voter-import-dialog.component.ts) so the UI still
// populates if the real backend uses a slightly different name — but
// this MUST be re-verified the first time a real upload job is created,
// and this comment updated with the confirmed real shape at that point.
export interface UploadJobRow {
  uploadId: string;
  uploadNo?: string | number | null;
  uploadDefinitionId?: string | null;
  uploadName?: string | null;
  uploadedAt?: string | null;
  totalCount?: number | null;
  successCount?: number | null;
  failedCount?: number | null;
  status?: string | null;
  remarks?: string | null;
}

export interface UploadJobHistoryRow {
  uploadId: string;
  actionDate?: string | null;
  actionType?: string | null;
  actionBy?: string | null;
  uploadNo?: string | number | null;
  uploadName?: string | null;
  totalCount?: number | null;
  successCount?: number | null;
  failedCount?: number | null;
  status?: string | null;
  remarks?: string | null;
}

export interface UploadSubmitRequest {
  definitionId: string;
  contextId?: string | null;
  requestId: string;
  file: File;
}
