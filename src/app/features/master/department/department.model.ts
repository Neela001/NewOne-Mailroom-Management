// Fields confirmed LIVE (real backend, real account, 2026-11-14) against
// GET https://newoneapi.nestien.com/swagger/v1/swagger.json
// (DepartmentRequest/DepartmentGetRequest/DepartmentHistoryResponse
// schemas) and a real authenticated master/department/get call — same
// real entity department.config.ts already documents; DEPARTMENT_CONFIG
// is kept and reused for the "View / History" dialog only (see
// department-list.component.ts's own comment for why Add/Edit needed a
// dedicated dialog instead).
//
// CONFIRMED LIVE: master/department/get's own real response ALREADY
// denormalizes companyCode/companyName/divisionCode/divisionName
// directly onto the row — no separate lookup fetch needed for the list's
// own columns.
//
// CONFIRMED LIVE: unlike Company Group's own companyGroupId gap on
// Company Master this session, Division really IS required server-side
// here — a real master/department/add probe that omitted divisionId
// entirely was rejected with exactly "DivisionId is required.". No
// UI-vs-API gap to report for this field.
//
// CONFIRMED LIVE: the backend itself enforces duplicate Department Code
// validation — a real probe reusing an existing real {companyId,
// divisionId, departmentCode} triple was rejected with "Duplicate record
// already exists." Never a frontend-only check invented here.
export interface DepartmentRow {
  departmentId: string;
  companyId?: string | null;
  companyCode?: string | null;
  companyName?: string | null;
  divisionId?: string | null;
  divisionCode?: string | null;
  divisionName?: string | null;
  departmentCode?: string | null;
  departmentName?: string | null;
  isActive: boolean;
}

export interface DepartmentSaveRequest {
  departmentId?: string | null;
  companyId?: string | null;
  divisionId?: string | null;
  departmentCode?: string | null;
  departmentName?: string | null;
  remarks?: string | null;
}
