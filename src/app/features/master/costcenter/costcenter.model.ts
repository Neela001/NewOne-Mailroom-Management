// Fields confirmed LIVE (real backend, real account, 2026-11-14) against
// GET https://newoneapi.nestien.com/swagger/v1/swagger.json
// (CostcenterRequest/CostcenterGetRequest/CostCenterHistoryResponse
// schemas) and a real authenticated master/costcenter/get call — same
// real entity costcenter.config.ts already documents;
// COSTCENTER_CONFIG is kept and reused for the "View / History" dialog
// only (see costcenter-list.component.ts's own comment for why Add/Edit
// needed a dedicated dialog instead — the same generic-dialog-chrome
// mismatch reasoning as Company Group/Division Master's own rebuilds
// this session).
//
// CONFIRMED LIVE: master/costcenter/get's own real response ALREADY
// denormalizes companyCode/companyName directly onto the row — no
// separate lookup fetch needed for the list's own column.
//
// CONFIRMED LIVE: the backend itself enforces duplicate Cost Center Code
// validation — a real master/costcenter/add probe reusing an existing
// real {companyId, costCenterCode} pair was rejected with exactly
// "Duplicate record already exists." Never a frontend-only check
// invented here.
export interface CostCenterRow {
  costCenterId: string;
  companyId?: string | null;
  companyCode?: string | null;
  companyName?: string | null;
  costCenterCode?: string | null;
  costCenterName?: string | null;
  isActive: boolean;
}

export interface CostCenterSaveRequest {
  costCenterId?: string | null;
  companyId?: string | null;
  costCenterCode?: string | null;
  costCenterName?: string | null;
  remarks?: string | null;
}
