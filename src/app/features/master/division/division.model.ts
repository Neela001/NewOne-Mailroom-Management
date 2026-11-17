// Fields confirmed LIVE (real backend, real account, 2026-11-14) against
// GET https://newoneapi.nestien.com/swagger/v1/swagger.json
// (DivisionRequest/DivisionGetRequest/DivisionHistoryResponse schemas)
// and a real authenticated master/division/get call — same real entity
// division.config.ts already documents; DIVISION_CONFIG is kept and
// reused for the "View / History" dialog only (see
// division-list.component.ts's own comment for why Add/Edit needed a
// dedicated dialog instead — the same "generic dialog chrome mismatch"
// reasoning as Company Group/Company Master's own rebuilds this session,
// not a cascading-dropdown one).
//
// CONFIRMED LIVE: master/division/get's own real response ALREADY
// denormalizes companyCode/companyName directly onto the row — no
// separate lookup fetch needed for the list's own column.
//
// CONFIRMED LIVE: the backend itself enforces duplicate Division Code
// validation (company-scoped) — a real master/division/add probe reusing
// an existing real {companyId, divisionCode} pair was rejected with
// exactly "Duplicate record already exists." — same real backend-enforced
// uniqueness rule as Company Group Master's own rebuild this session, not
// a frontend-only check invented here.
export interface DivisionRow {
  divisionId: string;
  companyId?: string | null;
  companyCode?: string | null;
  companyName?: string | null;
  divisionCode?: string | null;
  divisionName?: string | null;
  isActive: boolean;
}

export interface DivisionSaveRequest {
  divisionId?: string | null;
  companyId?: string | null;
  divisionCode?: string | null;
  divisionName?: string | null;
  remarks?: string | null;
}
