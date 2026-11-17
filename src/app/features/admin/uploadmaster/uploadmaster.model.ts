// Fields confirmed LIVE (real backend, real account, 2026-11-12) against
// GET https://newoneapi.nestien.com/swagger/v1/swagger.json and real
// authenticated POST calls. The real endpoints:
//   - admin/upload-master/get              (UploadDefinitionGetRequest ->
//                                           untyped ObjectApiResponse,
//                                           confirmed PascalCase at
//                                           runtime like every other
//                                           master entity's own /get)
//   - admin/upload-master/add / edit       (UploadDefinitionRequest — real
//                                           request schemas are already
//                                           camelCase, confirmed against
//                                           the live spec)
//   - admin/upload-master/delete           (also UploadDefinitionRequest —
//                                           no dedicated delete schema;
//                                           only uploadDefinitionId is
//                                           sent, matching the same
//                                           minimal-payload convention
//                                           every other entity's own
//                                           /delete already uses)
//   - admin/upload-master/history/get      (UploadDefinitionHistoryGetRequest
//                                           -> CONFIRMED LIVE this one is
//                                           ALSO raw PascalCase, unlike
//                                           Voter's own typed/camelCase
//                                           history — same fix as Desk/
//                                           Email Setting's own history.)
//   - admin/upload-master/procedures/get   (no request body — returns the
//                                           REAL, backend-pre-filtered list
//                                           of compatible stored procedures;
//                                           confirmed live: exactly 5 real
//                                           procedures, each already paired
//                                           with its own real
//                                           xmlParameterName and (nullable)
//                                           contextParameterName — this IS
//                                           the "Procedure Dependency
//                                           Logic" data source, see
//                                           uploadmaster-form-dialog.
//                                           component.ts's own comment for
//                                           why XML parameter/Context
//                                           parameter are therefore
//                                           auto-populated and locked,
//                                           never independently chosen.)
//
// "XML layout" (Tab 2): confirmed there is NO separate raw-XML
// blob/endpoint anywhere in the API — the real, only backing fields are
// xmlRootName/xmlRowName/columnsCsv, already present on
// UploadDefinitionRequest itself. Tab 2 is built around exactly these 3
// real fields (see uploadmaster-form-dialog.component.ts's own comment
// for the honest, non-invented way their preview is presented).
export interface UploadDefinitionGetRequest {
  uploadDefinitionId?: string | null;
  searchText?: string | null;
  isActive?: boolean | null;
}

export interface UploadDefinitionRow {
  uploadDefinitionId: string;
  uploadName?: string | null;
  procedureSchema?: string | null;
  procedureName?: string | null;
  xmlParameterName?: string | null;
  contextParameterName?: string | null;
  xmlRootName?: string | null;
  xmlRowName?: string | null;
  columnsCsv?: string | null;
  contextType?: string | null;
  isRetrySafe: boolean;
  isActive: boolean;
  remarks?: string | null;
}

export interface UploadDefinitionSaveRequest {
  uploadDefinitionId?: string | null;
  uploadName?: string | null;
  procedureSchema?: string | null;
  procedureName?: string | null;
  xmlParameterName?: string | null;
  contextParameterName?: string | null;
  xmlRootName?: string | null;
  xmlRowName?: string | null;
  columnsCsv?: string | null;
  contextType?: string | null;
  isRetrySafe: boolean;
  remarks?: string | null;
}

// One row of the real, backend-pre-filtered procedure list
// (admin/upload-master/procedures/get) — already uniquely paired with its
// own real xmlParameterName and (nullable) contextParameterName, so there
// is nothing left to "discover" client-side per procedure.
export interface UploadProcedureOption {
  procedureSchema: string;
  procedureName: string;
  xmlParameterName: string;
  contextParameterName?: string | null;
}

export interface UploadDefinitionHistoryRow {
  historyId: number;
  uploadDefinitionId: string;
  uploadName?: string | null;
  procedureSchema?: string | null;
  procedureName?: string | null;
  xmlParameterName?: string | null;
  contextParameterName?: string | null;
  xmlRootName?: string | null;
  xmlRowName?: string | null;
  columnsCsv?: string | null;
  contextType?: string | null;
  isRetrySafe?: boolean | null;
  isActive?: boolean | null;
  actionType?: string | null;
  actionDate?: string | null;
  actionBy?: string | null;
  remarks?: string | null;
}
