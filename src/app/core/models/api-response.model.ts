// The real response envelope every endpoint in the new API uses — confirmed
// directly from the live OpenAPI spec (GET /swagger/v1/swagger.json),
// e.g. LoginResponseApiResponse / CaptchaImageResponseApiResponse /
// CompanyHistoryResponseListApiResponse all share this exact shape. NOT the
// old app's {status: 0|1, data, mgs} envelope — a different backend entirely.
export interface ApiResponse<T> {
  success: boolean;
  message?: string | null;
  data: T;
  traceId?: string | null;
}

// CONFIRMED FROM THE REAL SPEC (not a guess): every master entity's own
// add/edit/delete/get action documents its response as the generic,
// untyped `ObjectApiResponse` (`data` has no further schema at all) —
// checked across Company/Country/Vendor's own add and get operations, all
// identical. Only the separate `/history/get` actions are properly typed
// (e.g. `CompanyHistoryResponseListApiResponse`, a real `T[]`). This is a
// real, systemic characteristic of this backend's generated spec, not
// missing research on this app's part — `MasterApiService` below reads
// `/get` responses defensively for this reason (see its own comment) and
// this needs confirming against one real authenticated call once test
// credentials for this API exist.
export type ApiListResponse<T> = ApiResponse<T[]>;
