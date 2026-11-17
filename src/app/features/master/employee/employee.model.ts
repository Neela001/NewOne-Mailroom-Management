// Fields confirmed LIVE (real backend, real account, 2026-11-14) against
// GET https://newoneapi.nestien.com/swagger/v1/swagger.json and a large
// set of real authenticated probes. EMPLOYEE_CONFIG (employee.config.ts)
// is kept and reused ONLY for the "View / History" action via
// MasterViewHistoryDialogComponent — see employee-list.component.ts's
// own comment for why Add/Edit needed a dedicated 3-tab dialog instead.
//
// CONFIRMED LIVE — this is NOT a plain add/edit/delete entity. The real
// backend exposes a dedicated combined-assignment API family:
//   - POST master/employee/save-with-assignments — ONE atomic call that
//     saves the Employee's own fields AND its full desired `locations`
//     and `secretaries` arrays together (EmployeeAssignmentSaveRequest).
//     CONFIRMED full-replace semantics: re-saving with `locations: []`/
//     `secretaries: []` does NOT delete prior rows, it soft-deactivates
//     every active row NOT present in the new array (isActive -> false)
//     while anything included either stays or is (re)created — exactly
//     like Branch Master's own save-with-locations. The Add/Edit dialog
//     must therefore always send the COMPLETE current desired set of
//     locations/secretaries on every save, not just newly added ones.
//   - POST master/employee/delete-with-assignments
//     (EmployeeAssignmentIdRequest {employeeId, remarks?}) — confirmed
//     live to also cascade-deactivate the employee's own location and
//     secretary assignment rows ("Employee and assignments deactivated."),
//     unlike plain master/employee/delete. Used for this dialog's own
//     Delete action instead of the plain endpoint.
//   - POST master/employee/assignments/get {employeeId} — returns
//     `data: { locations: [...], secretaries: [...] }` (a single object,
//     NOT an array of rows, unlike every other /get endpoint) — THE
//     restore-on-edit source for both the Locations and Secretaries
//     tabs. CONFIRMED LIVE it returns BOTH active and inactive rows, so
//     callers must filter `isActive === true` themselves to get the
//     currently-assigned set.
//   - POST master/employee/location-options/get
//     {siteId, employeeId?} — returns every Building/Floor/Wing
//     combination under a Site with an `IsAvailable` flag. CONFIRMED
//     LIVE `IsAvailable` does NOT mean "not already assigned to any
//     employee" — a combo already actively assigned to a real employee
//     still came back `IsAvailable: true`, and passing `employeeId`
//     produced an identical result to omitting it. So `IsAvailable`
//     reflects only whether that Building/Floor/Wing combination itself
//     is active/assignable in general, not per-employee exclusivity —
//     the same workstation can legitimately be assigned to more than one
//     employee. Nothing beyond this confirmed meaning is implemented;
//     per-employee duplicate prevention (below) is a separate, real rule.
//   - Real backend-enforced business rules, confirmed via live rejection
//     messages through save-with-assignments:
//       - Self-reporting: "An employee cannot report to themself."
//       - Self/duplicate secretary: "Select each secretary once,
//         excluding the employee themself."
//       - Duplicate location (same siteId+buildingId+floorId+wingId
//         twice in one save): "Duplicate employee locations are not
//         allowed."
//     All three are also prevented client-side before submit, but the
//     dialog surfaces the real backend message verbatim if one slips
//     through (e.g. a stale in-memory duplicate from a race).
//   - CONFIRMED LIVE: `secretaryFlag` is a plain, real, NOT-NULL boolean
//     column on the Employee row (a real add attempt that omitted it
//     failed with a raw SQL "Cannot insert the value NULL into column
//     'SecretaryFlag'" constraint error) — it is NOT backend-derived
//     automatically from EmployeeSecretary rows. Per this task's own
//     "must be derived from actual secretary assignments, not
//     independently maintained as an unrelated boolean" instruction, the
//     dialog treats it as a read-only, UI-computed display value
//     (true when the current secretaries array is non-empty) and always
//     sends that computed value explicitly on every save — never a
//     directly user-edited checkbox.
//   - CONFIRMED LIVE: master/employee/get's own EmployeeGetRequest schema
//     has no companyId filter param (only employeeId/searchText/
//     isActive) — a live probe sending companyId anyway returned the
//     same unfiltered result. The listing's own Company filter (All
//     companies vs a specific Company) is therefore done CLIENT-SIDE,
//     same established pattern as every other cascading entity this
//     session.
//   - CONFIRMED LIVE: SiteRow has NO companyId field at all (Site is a
//     shared, company-independent resource — same finding Branch
//     Master's own investigation made this session). The Locations tab's
//     Site dropdown therefore lists ALL active Sites regardless of the
//     selected Company — this directly contradicts this task's own
//     assumption that Sites are scoped "to the selected employee/
//     company"; implemented per the confirmed real behavior instead.
//   - Branch/Division/Department/CostCenter/Designation all carry a real
//     companyId field directly on their own row (confirmed from each
//     entity's own real /get response) and their own GetRequest schemas
//     have no server-side companyId filter — filtered CLIENT-SIDE by
//     that field, same pattern as every other cascading dropdown this
//     session.
//   - master/employee/get's own real response already fully denormalizes
//     every listing column this task asks for (CompanyName, BranchName,
//     DepartmentName, DesignationName, ReportingManagerName/Code,
//     SecretaryFlag, EmailId, MobileNo, IsActive) — no extra lookup
//     fetches needed for the listing.
export interface EmployeeRow {
  employeeId: string;
  companyId?: string | null;
  branchId?: string | null;
  divisionId?: string | null;
  departmentId?: string | null;
  costCenterId?: string | null;
  designationId?: string | null;
  employeeCode?: string | null;
  fullName?: string | null;
  gender?: string | null;
  cabinName?: string | null;
  emailId?: string | null;
  mobileNo?: string | null;
  dateOfJoining?: string | null;
  reportingManagerId?: string | null;
  secretaryFlag?: boolean | null;
  isActive: boolean;
  companyCode?: string | null;
  companyName?: string | null;
  branchCode?: string | null;
  branchName?: string | null;
  divisionCode?: string | null;
  divisionName?: string | null;
  departmentCode?: string | null;
  departmentName?: string | null;
  costCenterCode?: string | null;
  costCenterName?: string | null;
  designationCode?: string | null;
  designationName?: string | null;
  reportingManagerCode?: string | null;
  reportingManagerName?: string | null;
}

export interface EmployeeAssignmentLocationItem {
  siteId: string;
  buildingId?: string | null;
  floorId?: string | null;
  wingId?: string | null;
}

export interface EmployeeAssignmentSecretaryItem {
  secretaryEmployeeId: string;
}

// The local, display-enriched shape each tab's own table renders — the
// bare IDs above are all that's actually sent on save; the rest is
// carried alongside purely for the grid's own columns, sourced either
// from master/employee/assignments/get's own denormalized rows (Edit
// restore) or from the already-denormalized location-options/employee-
// search rows at the moment a row is added (Add), so no extra lookup
// fetch is ever needed for display.
export interface EmployeeLocationAssignmentDisplay extends EmployeeAssignmentLocationItem {
  siteCode?: string | null;
  siteName?: string | null;
  buildingCode?: string | null;
  buildingName?: string | null;
  floorCode?: string | null;
  floorName?: string | null;
  wingCode?: string | null;
  wingName?: string | null;
}

export interface EmployeeSecretaryAssignmentDisplay extends EmployeeAssignmentSecretaryItem {
  secretaryEmployeeCode?: string | null;
  secretaryEmployeeName?: string | null;
  secretaryEmailId?: string | null;
  secretaryDepartmentName?: string | null;
  secretaryBranchName?: string | null;
  secretaryCompanyName?: string | null;
}

export interface EmployeeAssignmentsResponse {
  locations: EmployeeLocationAssignmentDisplay[];
  secretaries: EmployeeSecretaryAssignmentDisplay[];
}

export interface EmployeeLocationOptionRow {
  siteId: string;
  siteCode?: string | null;
  siteName?: string | null;
  buildingId?: string | null;
  buildingName?: string | null;
  floorId?: string | null;
  floorName?: string | null;
  wingId?: string | null;
  wingName?: string | null;
  isAvailable?: boolean | null;
}

export interface EmployeeSaveRequest {
  employeeId?: string | null;
  companyId: string;
  branchId?: string | null;
  divisionId?: string | null;
  departmentId?: string | null;
  costCenterId?: string | null;
  designationId?: string | null;
  employeeCode?: string | null;
  fullName?: string | null;
  gender?: string | null;
  cabinName?: string | null;
  emailId?: string | null;
  mobileNo?: string | null;
  dateOfJoining?: string | null;
  reportingManagerId?: string | null;
  secretaryFlag: boolean;
  remarks?: string | null;
  locations: EmployeeAssignmentLocationItem[];
  secretaries: EmployeeAssignmentSecretaryItem[];
}
