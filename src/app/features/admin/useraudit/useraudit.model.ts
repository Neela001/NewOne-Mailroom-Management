// Fields copied field-for-field from the real spec's UserAuditSearchRequest
// (schema literally named with userId/userName/actionType/apiStatus/
// fromDate/toDate/pageNumber/pageSize) and UserAuditEvent / UserAuditSearchResponse
// schemas (GET https://newoneapi.nestien.com/swagger/v1/swagger.json).
//
// UserAudit does NOT fit the generic MasterEntityConfig framework: it is a
// read-only paginated log (POST admin/audit/get) with no add/edit/delete at
// all, and no .../history/get either — built as its own dedicated,
// view-only feature.
export interface UserAuditSearchRequest {
  userId?: string | null;
  userName?: string | null;
  actionType?: string | null;
  apiStatus?: string | null;
  fromDate?: string | null;
  toDate?: string | null;
  pageNumber: number;
  pageSize: number;
}

export interface UserAuditEvent {
  auditId: number;
  userId?: string | null;
  userName?: string | null;
  actionType?: string | null;
  httpMethod?: string | null;
  requestPath?: string | null;
  statusCode: number;
  apiStatus?: string | null;
  errorDetails?: string | null;
  ipAddress?: string | null;
  traceId?: string | null;
  occurredAtUtc: string;
  durationMs: number;
}

export interface UserAuditSearchResponse {
  totalCount: number;
  pageNumber: number;
  pageSize: number;
  totalPages: number;
  items?: UserAuditEvent[] | null;
}
