// Fields confirmed LIVE (real backend, real account, 2026-11-14) against
// GET https://newoneapi.nestien.com/swagger/v1/swagger.json
// (CompanygroupRequest/CompanygroupGetRequest/CompanyGroupHistoryResponse
// schemas) and a real authenticated master/companygroup/get call — same
// real entity companygroup.config.ts already documents;
// COMPANYGROUP_CONFIG is kept and reused for the "View / History" dialog
// only (see companygroup-list.component.ts's own comment for why Add/
// Edit needed a dedicated dialog instead — not a cascading-dropdown
// complexity like every other location Master this session, but a real
// mismatch in the generic dialog's own fixed header/footer chrome; see
// that file's own comment for the full reasoning).
//
// CONFIRMED LIVE: this is a genuinely flat, standalone entity — the real
// master/companygroup/get row has ONLY
// {CompanyGroupId, CompanyGroupCode, CompanyGroupName, IsActive}, no
// hidden parent relationship or foreign key of any kind.
//
// CONFIRMED LIVE: the backend itself enforces duplicate Company Group
// Code validation — a real master/companygroup/add probe reusing an
// existing real code was rejected with exactly "Duplicate record already
// exists." This is real backend-enforced uniqueness, not a frontend-only
// check invented here; the error surfaces through this dialog's own
// errorMessage signal exactly as the backend sends it.
export interface CompanyGroupRow {
  companyGroupId: string;
  companyGroupCode?: string | null;
  companyGroupName?: string | null;
  isActive: boolean;
}

export interface CompanyGroupSaveRequest {
  companyGroupId?: string | null;
  companyGroupCode?: string | null;
  companyGroupName?: string | null;
  remarks?: string | null;
}
