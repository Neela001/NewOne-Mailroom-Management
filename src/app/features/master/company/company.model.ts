// Fields confirmed LIVE (real backend, real account, 2026-11-14) against
// GET https://newoneapi.nestien.com/swagger/v1/swagger.json
// (CompanyRequest/CompanyGetRequest/CompanyHistoryResponse schemas) and a
// real authenticated master/company/get call — same real entity
// company.config.ts already documents; COMPANY_CONFIG is kept and reused
// for the "View / History" dialog only (see company-list.component.ts's
// own comment for why Add/Edit needed a dedicated dialog instead).
//
// CONFIRMED LIVE: master/company/get's own real response ALREADY
// denormalizes companyGroupCode/companyGroupName directly onto the row —
// no separate lookup fetch needed for the list's own column.
//
// CONFIRMED LIVE (important gap): CompanyRequest's own real companyGroupId
// is NULLABLE and is NOT in the schema's own `required` list — a real
// master/company/add probe that omitted companyGroupId entirely
// succeeded. This task's own brief explicitly asks for Company Group to
// be enforced as mandatory in the UI regardless ("Do not allow saving
// without a valid Company Group selection") — a legitimate UI-stricter-
// than-API choice, implemented here as a real Validators.required on the
// companyGroupId control, NOT a backend-enforced rule. Reported in this
// module's own final report as a genuine gap: the real API itself would
// accept a Company with no Group if ever called directly, bypassing this
// UI.
export interface CompanyRow {
  companyId: string;
  companyGroupId?: string | null;
  companyGroupCode?: string | null;
  companyGroupName?: string | null;
  companyCode?: string | null;
  companyName?: string | null;
  legalName?: string | null;
  registrationNo?: string | null;
  taxRegistrationNo?: string | null;
  isActive: boolean;
}

export interface CompanySaveRequest {
  companyId?: string | null;
  companyGroupId?: string | null;
  companyCode?: string | null;
  companyName?: string | null;
  legalName?: string | null;
  registrationNo?: string | null;
  taxRegistrationNo?: string | null;
  remarks?: string | null;
}
