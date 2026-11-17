// Fields confirmed LIVE (real backend, real account, 2026-11-11) against
// GET https://newoneapi.nestien.com/swagger/v1/swagger.json and a real
// authenticated master/voter-record/get call (702 real rows already in
// this tenant, real Tamil name/relative-name data). The real endpoints:
//   - master/voter-record/get           (VoterRecordGetRequest — untyped
//                                        ObjectApiResponse, confirmed
//                                        PascalCase at runtime like every
//                                        other master entity's own /get.
//                                        Its own real filter fields are
//                                        ONLY {voterRecordId, voterId,
//                                        wardNo, boothNo, searchText,
//                                        isActive} — no separate name/
//                                        relativeName/houseNumber filter
//                                        exists server-side; "Name /
//                                        relative / house" is ONE combined
//                                        searchText field, matching this
//                                        schema exactly.)
//   - master/voter-record/add / edit    (VoterRecordRequest)
//   - master/voter-record/delete        (needs voterRecordId — no
//                                        dedicated VoterRecordDeleteRequest
//                                        schema, matches the generic
//                                        {idField} pattern every other
//                                        master entity's own /delete uses)
//   - master/voter-record/history/get   (VoterRecordHistoryGetRequest ->
//                                        a REAL typed, camelCase response
//                                        — VoterRecordHistoryResponseListApiResponse
//                                        — unlike Desk/Email Setting's own
//                                        history, which needed a PascalCase
//                                        fix; this one needs no normalizing)
//   - master/voter-record/import-batch  (VoterBatchRequest ->
//                                        VoterBatchResponse — the ONLY
//                                        real import mechanism: a plain
//                                        JSON array of already-structured
//                                        rows, not a file upload. CONFIRMED
//                                        LIVE there is no OCR/image/PDF
//                                        extraction endpoint anywhere in
//                                        the API — the only other
//                                        candidate, the generic
//                                        admin/uploads/* pipeline, has
//                                        exactly 2 configured
//                                        UploadDefinitions ("Country
//                                        Vertical Data", "Courier Zone
//                                        Destinations"), both a plain
//                                        Excel-row-to-stored-procedure-XML
//                                        pipeline with no Voter definition
//                                        and no OCR/image/PDF concept at
//                                        all — see voter-import-dialog.
//                                        component.ts's own comment.)
export type VoterRelationType = 'Husband' | 'Father' | 'Mother' | 'Other' | 'Unclear' | string;
export type VoterGender = 'Male' | 'Female' | 'Other';

export interface VoterGetRequest {
  voterRecordId?: string | null;
  voterId?: string | null;
  wardNo?: string | null;
  boothNo?: string | null;
  searchText?: string | null;
  isActive?: boolean | null;
}

export interface VoterRow {
  voterRecordId: string;
  wardNo?: string | null;
  boothNo?: string | null;
  serialNumber?: number | null;
  voterId?: string | null;
  name?: string | null;
  relationType?: VoterRelationType | null;
  relativeName?: string | null;
  houseNumber?: string | null;
  age?: number | null;
  gender?: VoterGender | null;
  isActive: boolean;
}

export interface VoterSaveRequest {
  voterRecordId?: string | null;
  wardNo?: string | null;
  boothNo?: string | null;
  serialNumber?: number | null;
  voterId?: string | null;
  name?: string | null;
  relationType?: string | null;
  relativeName?: string | null;
  houseNumber?: string | null;
  age?: number | null;
  gender?: string | null;
  remarks?: string | null;
}

export interface VoterHistoryRow {
  voterRecordHistoryId: number;
  voterRecordId: string;
  wardNo?: string | null;
  boothNo?: string | null;
  serialNumber?: number | null;
  voterId?: string | null;
  name?: string | null;
  relationType?: string | null;
  relativeName?: string | null;
  houseNumber?: string | null;
  age?: number | null;
  gender?: string | null;
  isActive?: boolean | null;
  actionType?: string | null;
  actionBy?: string | null;
  actionDate?: string | null;
  remarks?: string | null;
}

// The real save-with-locations-style batch row shape (master/voter-record/
// import-batch) — clientRowId is this frontend's own correlation id (a
// fresh uuid per preview row), used to match each VoterBatchResult back to
// the row that produced it (the response carries no other identifying
// field for a row that failed before it ever got a real voterRecordId).
export interface VoterBatchRow {
  clientRowId: string;
  wardNo?: string | null;
  boothNo?: string | null;
  serialNumber?: number | null;
  voterId?: string | null;
  name?: string | null;
  relationType?: string | null;
  relativeName?: string | null;
  houseNumber?: string | null;
  age?: number | null;
  gender?: string | null;
  remarks?: string | null;
}

export interface VoterBatchResult {
  clientRowId: string;
  success: boolean;
  code?: string | null;
  message?: string | null;
  voterRecordId?: string | null;
}
