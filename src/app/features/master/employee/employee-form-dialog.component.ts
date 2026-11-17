import { Component, Inject, OnInit, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { DIALOG_DATA } from '../../../shared/ui/dialog/dialog-data.token';
import { DialogRef } from '../../../shared/ui/dialog/dialog-ref';
import { DialogService } from '../../../shared/ui/dialog/dialog.service';
import { ConfirmDialogComponent } from '../shared/confirm-dialog.component';
import { MasterApiService } from '../shared/master-api.service';
import { ApiService } from '../../../core/services/api.service';
import { normalizeRowKeys } from '../shared/pascal-case.util';
import {
  EmployeeAssignmentsResponse,
  EmployeeLocationAssignmentDisplay,
  EmployeeLocationOptionRow,
  EmployeeRow,
  EmployeeSaveRequest,
  EmployeeSecretaryAssignmentDisplay,
} from './employee.model';
import { CompanyRow } from '../company/company.model';
import { BranchRow } from '../branch/branch.model';
import { DivisionRow } from '../division/division.model';
import { DepartmentRow } from '../department/department.model';
import { CostCenterRow } from '../costcenter/costcenter.model';
import { DesignationRow } from '../designation/designation.model';
import { SiteRow } from '../site/site.model';
import { extractApiErrorMessage, usableMessage } from '../../../core/utils/api-error.util';
import { handleFormEnterKey } from '../../../core/utils/form-keyboard.util';
import { ButtonComponent } from '../../../shared/ui/button/button.component';
import { InputComponent } from '../../../shared/ui/form/input.component';
import { TextareaComponent } from '../../../shared/ui/form/textarea.component';
import { ComboboxComponent } from '../../../shared/ui/form/combobox.component';
import { SelectComponent, SelectOption } from '../../../shared/ui/form/select.component';
import { IconComponent } from '../../../shared/ui/icon/icon.component';

const GENDER_OPTIONS: SelectOption[] = [
  { label: 'Male', value: 'Male' },
  { label: 'Female', value: 'Female' },
  { label: 'Other', value: 'Other' },
];

export interface EmployeeFormDialogData {
  row: EmployeeRow | null; // null for 'add', present for 'edit'
  mode: 'add' | 'edit';
}

export type EmployeeFormDialogResult = boolean;

type TabKey = 'details' | 'locations' | 'secretaries';

function locationKey(l: { siteId: string; buildingId?: string | null; floorId?: string | null; wingId?: string | null }): string {
  return `${l.siteId}|${l.buildingId ?? ''}|${l.floorId ?? ''}|${l.wingId ?? ''}`;
}

// Add/Edit Employee — the most involved dialog in this project. Not
// MasterFormDialogComponent-driven: a genuine 3-tab workflow (Employee
// Details, Locations, Secretaries) built on a dedicated combined-
// assignment API family with no shape in the generic formFields model.
// See employee.model.ts's own class-level comment for the full
// confirmed-live API writeup this dialog implements exactly:
//   - Always saves through master/employee/save-with-assignments (never
//     the plain add/edit), sending the COMPLETE current desired
//     locations[]/secretaries[] arrays every time (confirmed full-replace
//     semantics — anything omitted gets soft-deactivated server-side).
//   - secretaryFlag is a derived, read-only display value (secretaries
//     count > 0), always computed and sent explicitly — never a directly
//     user-edited checkbox (confirmed a real NOT-NULL column; omitting
//     it fails with a raw SQL constraint error).
//   - Self-reporting and self/duplicate-secretary and duplicate-location
//     are all real backend-enforced rules (exact messages confirmed live
//     and quoted in this file's own onSubmit()); also pre-empted
//     client-side so the user sees the problem before submitting.
//   - Site is NOT Company-scoped (SiteRow has no companyId at all,
//     confirmed live) — the Locations tab's Site dropdown lists every
//     active Site regardless of the selected Company, deliberately
//     contradicting this task's own "available to the selected
//     employee/company" assumption.
//   - Branch/Division/Department/CostCenter/Designation/Reporting
//     Manager are all filtered client-side by the selected Company's own
//     companyId field (no server-side filter exists on any of their
//     GetRequest schemas) — same established pattern as every other
//     cascading dialog this session.
@Component({
  selector: 'app-employee-form-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, FormsModule, ButtonComponent, InputComponent, TextareaComponent, ComboboxComponent, SelectComponent, IconComponent],
  templateUrl: './employee-form-dialog.component.html',
  styleUrl: './employee-form-dialog.component.scss',
})
export class EmployeeFormDialogComponent implements OnInit {
  private readonly masterApi = inject(MasterApiService);
  private readonly api = inject(ApiService);
  private readonly dialogService = inject(DialogService);
  protected readonly dialogRef = inject(DialogRef<EmployeeFormDialogResult>);

  protected readonly isEdit: boolean;
  protected readonly genderOptions = GENDER_OPTIONS;
  private readonly currentEmployeeId: string | null;
  protected readonly saving = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly form: FormGroup;
  protected readonly activeTab = signal<TabKey>('details');

  // --- Master/lookup data (all loaded once; Branch/Division/Department/
  // CostCenter/Designation/Reporting Manager are filtered client-side by
  // Company below; Sites are NOT Company-filtered — confirmed live) ---
  protected readonly masterDataLoading = signal(true);
  protected readonly masterDataError = signal(false);
  private readonly companies = signal<CompanyRow[]>([]);
  private readonly branches = signal<BranchRow[]>([]);
  private readonly divisions = signal<DivisionRow[]>([]);
  private readonly departments = signal<DepartmentRow[]>([]);
  private readonly costCenters = signal<CostCenterRow[]>([]);
  private readonly designations = signal<DesignationRow[]>([]);
  private readonly employees = signal<EmployeeRow[]>([]);
  private readonly sites = signal<SiteRow[]>([]);

  // Plain signal set explicitly from valueChanges, NOT a computed()
  // reading a FormControl's .value directly — the established
  // anti-pattern this session.
  protected readonly selectedCompanyId = signal<string>('');
  private readonly originalCompanyId: string | null;

  protected readonly companyOptions = computed<SelectOption[]>(() => this.companies().filter((c) => c.isActive || c.companyId === this.originalCompanyId).map((c) => this.toOption(c.companyId, c.companyCode, c.companyName)));

  // Each dependent list: eligible (active + matching selected Company),
  // unioned with the row's own originally-saved option when the selected
  // Company still equals the row's own original Company (preserves a
  // saved-but-now-ineligible value through Edit's initial async load
  // without permanently pinning it once the user actually changes
  // Company) — same "preserve saved option" pattern as every other
  // cascading dialog this session, applied per dependent field.
  private sameAsOriginalCompany(): boolean {
    return this.selectedCompanyId() === (this.originalCompanyId ?? '');
  }

  protected readonly branchOptions = computed<SelectOption[]>(() => {
    const cid = this.selectedCompanyId();
    const rows = this.branches().filter((b) => b.isActive && b.companyId === cid);
    const saved = this.data.row?.branchId;
    if (saved && this.sameAsOriginalCompany() && !rows.some((b) => b.branchId === saved)) {
      const savedRow = this.branches().find((b) => b.branchId === saved);
      if (savedRow) rows.unshift(savedRow);
    }
    return rows.map((b) => this.toOption(b.branchId, b.branchCode, b.branchName));
  });

  protected readonly divisionOptions = computed<SelectOption[]>(() => {
    const cid = this.selectedCompanyId();
    const rows = this.divisions().filter((d) => d.isActive && d.companyId === cid);
    const saved = this.data.row?.divisionId;
    if (saved && this.sameAsOriginalCompany() && !rows.some((d) => d.divisionId === saved)) {
      const savedRow = this.divisions().find((d) => d.divisionId === saved);
      if (savedRow) rows.unshift(savedRow);
    }
    return rows.map((d) => this.toOption(d.divisionId, d.divisionCode, d.divisionName));
  });

  protected readonly departmentOptions = computed<SelectOption[]>(() => {
    const cid = this.selectedCompanyId();
    const rows = this.departments().filter((d) => d.isActive && d.companyId === cid);
    const saved = this.data.row?.departmentId;
    if (saved && this.sameAsOriginalCompany() && !rows.some((d) => d.departmentId === saved)) {
      const savedRow = this.departments().find((d) => d.departmentId === saved);
      if (savedRow) rows.unshift(savedRow);
    }
    return rows.map((d) => this.toOption(d.departmentId, d.departmentCode, d.departmentName));
  });

  protected readonly costCenterOptions = computed<SelectOption[]>(() => {
    const cid = this.selectedCompanyId();
    const rows = this.costCenters().filter((c) => c.isActive && c.companyId === cid);
    const saved = this.data.row?.costCenterId;
    if (saved && this.sameAsOriginalCompany() && !rows.some((c) => c.costCenterId === saved)) {
      const savedRow = this.costCenters().find((c) => c.costCenterId === saved);
      if (savedRow) rows.unshift(savedRow);
    }
    return rows.map((c) => this.toOption(c.costCenterId, c.costCenterCode, c.costCenterName));
  });

  protected readonly designationOptions = computed<SelectOption[]>(() => {
    const cid = this.selectedCompanyId();
    const rows = this.designations().filter((d) => d.isActive && d.companyId === cid);
    const saved = this.data.row?.designationId;
    if (saved && this.sameAsOriginalCompany() && !rows.some((d) => d.designationId === saved)) {
      const savedRow = this.designations().find((d) => d.designationId === saved);
      if (savedRow) rows.unshift(savedRow);
    }
    return rows.map((d) => this.toOption(d.designationId, d.designationCode, d.designationName));
  });

  // Reporting Manager: active employees in the same Company, excluding
  // this employee itself (self-reporting is also backend-enforced — see
  // this file's own class comment — but excluding it from the list
  // prevents the user from ever picking it in the first place). This
  // Company-scoping is a UI-only convenience, NOT backend-enforced —
  // EmployeeGetRequest has no companyId filter and the backend never
  // rejected a cross-company reportingManagerId in testing; flagged here
  // and in the final report rather than silently presented as a hard rule.
  protected readonly reportingManagerOptions = computed<SelectOption[]>(() => {
    const cid = this.selectedCompanyId();
    const rows = this.employees().filter((e) => e.isActive && e.companyId === cid && e.employeeId !== this.currentEmployeeId);
    const saved = this.data.row?.reportingManagerId;
    if (saved && this.sameAsOriginalCompany() && !rows.some((e) => e.employeeId === saved)) {
      const savedRow = this.employees().find((e) => e.employeeId === saved);
      if (savedRow) rows.unshift(savedRow);
    }
    return rows.map((e) => this.toOption(e.employeeId, e.employeeCode, e.fullName));
  });

  protected readonly siteOptions = computed<SelectOption[]>(() => this.sites().filter((s) => s.isActive).map((s) => this.toOption(s.siteId, s.siteCode, s.siteName)));

  // --- Locations tab state ---
  protected readonly locations = signal<EmployeeLocationAssignmentDisplay[]>([]);
  protected readonly selectedSiteId = signal<string>('');
  protected readonly locationOptionsLoading = signal(false);
  protected readonly locationOptionsError = signal(false);
  private readonly locationOptionsForSite = signal<EmployeeLocationOptionRow[]>([]);
  protected readonly selectedAvailableKey = signal<string | null>(null);
  protected readonly selectedAssignedKey = signal<string | null>(null);
  private locationRequestToken = 0;

  // Available Workstations for the selected Site — CONFIRMED LIVE
  // IsAvailable does NOT mean "not already assigned to any employee" (see
  // this file's own class comment); it reflects only that
  // Building/Floor/Wing row's own general active/assignable state. This
  // table shows exactly that, minus combinations already in THIS
  // employee's own Assigned Workstations list (so the Add action can
  // never create a duplicate for the employee being edited).
  protected readonly availableWorkstationRows = computed(() => {
    const assignedKeys = new Set(this.locations().map(locationKey));
    return this.locationOptionsForSite().filter((o) => o.isAvailable !== false && !assignedKeys.has(locationKey({ siteId: o.siteId, buildingId: o.buildingId, floorId: o.floorId, wingId: o.wingId })));
  });

  // --- Secretaries tab state ---
  protected readonly secretaries = signal<EmployeeSecretaryAssignmentDisplay[]>([]);
  protected readonly secretarySearchValue = signal<string>('');
  protected readonly selectedSecretaryKey = signal<string | null>(null);

  protected readonly secretaryCandidateOptions = computed<SelectOption[]>(() => {
    const assigned = new Set(this.secretaries().map((s) => s.secretaryEmployeeId));
    return this.employees()
      .filter((e) => e.isActive && e.employeeId !== this.currentEmployeeId && !assigned.has(e.employeeId))
      .map((e) => this.toOption(e.employeeId, e.employeeCode, e.fullName));
  });

  // CONFIRMED LIVE: secretaryFlag is a real, plain, NOT-NULL column — not
  // backend-derived. This dialog treats it as read-only/derived from the
  // Secretaries tab's own current list and always sends it explicitly.
  protected readonly secretaryFlag = computed(() => this.secretaries().length > 0);

  protected readonly helperText = computed(() => (this.selectedCompanyId() ? 'Ready' : 'Select Company, then enter the Employee details.'));

  // Tracks whether assignment-tab state has changed, since locations()/
  // secretaries() are plain signals outside the FormGroup and wouldn't
  // otherwise register as "dirty" for the Cancel-confirmation check.
  private initialLocationsSnapshot = '';
  private initialSecretariesSnapshot = '';
  protected readonly hasUnsavedChanges = computed(() => {
    const locDirty = JSON.stringify(this.locations().map(locationKey).sort()) !== this.initialLocationsSnapshot;
    const secDirty =
      JSON.stringify(
        this.secretaries()
          .map((s) => s.secretaryEmployeeId)
          .sort(),
      ) !== this.initialSecretariesSnapshot;
    return this.form.dirty || locDirty || secDirty;
  });

  constructor(@Inject(DIALOG_DATA) public data: EmployeeFormDialogData) {
    this.isEdit = data.mode === 'edit';
    const row = data.row;
    this.currentEmployeeId = row?.employeeId ?? null;
    this.originalCompanyId = row?.companyId ?? null;

    this.form = new FormGroup({
      employeeId: new FormControl(row?.employeeId ?? null),
      companyId: new FormControl(row?.companyId ?? '', [Validators.required]),
      employeeCode: new FormControl(row?.employeeCode ?? '', [Validators.required, Validators.maxLength(50)]),
      fullName: new FormControl(row?.fullName ?? '', [Validators.required, Validators.maxLength(200)]),
      gender: new FormControl(row?.gender ?? ''),
      branchId: new FormControl(row?.branchId ?? ''),
      divisionId: new FormControl(row?.divisionId ?? ''),
      departmentId: new FormControl(row?.departmentId ?? ''),
      costCenterId: new FormControl(row?.costCenterId ?? ''),
      designationId: new FormControl(row?.designationId ?? ''),
      reportingManagerId: new FormControl(row?.reportingManagerId ?? ''),
      cabinName: new FormControl(row?.cabinName ?? ''),
      emailId: new FormControl(row?.emailId ?? ''),
      mobileNo: new FormControl(row?.mobileNo ?? ''),
      dateOfJoining: new FormControl(row?.dateOfJoining ? row.dateOfJoining.slice(0, 10) : ''),
      // Always blank, including on Edit — same confirmed-live
      // write-only-per-action changelog behavior as every other Master's
      // own remarks fields this session.
      remarks: new FormControl(''),
    });

    this.form.get('companyId')!.valueChanges.subscribe((companyId: string) => {
      const previous = this.selectedCompanyId();
      this.selectedCompanyId.set(companyId);
      // Reset dependents only on a REAL user-driven change (previous
      // value already initialized, i.e. not the first sync below) —
      // clears now-invalid selections, per this task's own "Clear
      // invalid dependent selections when their parent changes" rule.
      if (previous !== '' || this.form.get('companyId')!.dirty) {
        this.form.patchValue({ branchId: '', divisionId: '', departmentId: '', costCenterId: '', designationId: '', reportingManagerId: '' });
      }
    });
    this.selectedCompanyId.set(this.form.get('companyId')!.value);
  }

  ngOnInit(): void {
    this.loadMasterData();
    if (this.isEdit && this.currentEmployeeId) {
      this.loadAssignments(this.currentEmployeeId);
    } else {
      this.initialLocationsSnapshot = JSON.stringify([]);
      this.initialSecretariesSnapshot = JSON.stringify([]);
    }
  }

  private toOption(value: string | null | undefined, code: string | null | undefined, name: string | null | undefined): SelectOption {
    return { label: code ? `${name ?? ''} (${code})` : (name ?? ''), value: value ?? '' };
  }

  // --- Master data loading ---
  private loadMasterData(): void {
    this.masterDataLoading.set(true);
    this.masterDataError.set(false);
    let remaining = 8;
    let hadError = false;
    const done = () => {
      remaining--;
      if (remaining === 0) {
        this.masterDataLoading.set(false);
        this.masterDataError.set(hadError);
      }
    };
    const onError = () => {
      hadError = true;
      done();
    };

    this.masterApi.get<Record<string, unknown>, CompanyRow>('master/company', { searchText: null, isActive: null }).subscribe({ next: (r) => (this.companies.set(r), done()), error: onError });
    this.masterApi.get<Record<string, unknown>, BranchRow>('master/branch', { searchText: null, isActive: null }).subscribe({ next: (r) => (this.branches.set(r), done()), error: onError });
    this.masterApi.get<Record<string, unknown>, DivisionRow>('master/division', { searchText: null, isActive: null }).subscribe({ next: (r) => (this.divisions.set(r), done()), error: onError });
    this.masterApi.get<Record<string, unknown>, DepartmentRow>('master/department', { searchText: null, isActive: null }).subscribe({ next: (r) => (this.departments.set(r), done()), error: onError });
    this.masterApi.get<Record<string, unknown>, CostCenterRow>('master/costcenter', { searchText: null, isActive: null }).subscribe({ next: (r) => (this.costCenters.set(r), done()), error: onError });
    this.masterApi.get<Record<string, unknown>, DesignationRow>('master/designation', { searchText: null, isActive: null }).subscribe({ next: (r) => (this.designations.set(r), done()), error: onError });
    this.masterApi.get<Record<string, unknown>, EmployeeRow>('master/employee', { searchText: null, isActive: null }).subscribe({ next: (r) => (this.employees.set(r), done()), error: onError });
    this.masterApi.get<Record<string, unknown>, SiteRow>('master/site', { searchText: null, isActive: null }).subscribe({ next: (r) => (this.sites.set(r), done()), error: onError });
  }

  // Reload data — re-fetches every lookup list without touching the
  // Employee Details form, Locations or Secretaries state. If a
  // selection is no longer eligible after the reload, it's cleared and
  // reported — never silently kept invalid, never silently clearing
  // assignment tabs this button has no business touching.
  protected reloadData(): void {
    this.masterDataLoading.set(true);
    this.masterDataError.set(false);
    let remaining = 8;
    let hadError = false;
    const done = () => {
      remaining--;
      if (remaining === 0) {
        this.masterDataLoading.set(false);
        this.masterDataError.set(hadError);
        this.pruneInvalidSelections();
      }
    };
    const onError = () => {
      hadError = true;
      done();
    };
    this.masterApi.get<Record<string, unknown>, CompanyRow>('master/company', { searchText: null, isActive: null }).subscribe({ next: (r) => (this.companies.set(r), done()), error: onError });
    this.masterApi.get<Record<string, unknown>, BranchRow>('master/branch', { searchText: null, isActive: null }).subscribe({ next: (r) => (this.branches.set(r), done()), error: onError });
    this.masterApi.get<Record<string, unknown>, DivisionRow>('master/division', { searchText: null, isActive: null }).subscribe({ next: (r) => (this.divisions.set(r), done()), error: onError });
    this.masterApi.get<Record<string, unknown>, DepartmentRow>('master/department', { searchText: null, isActive: null }).subscribe({ next: (r) => (this.departments.set(r), done()), error: onError });
    this.masterApi.get<Record<string, unknown>, CostCenterRow>('master/costcenter', { searchText: null, isActive: null }).subscribe({ next: (r) => (this.costCenters.set(r), done()), error: onError });
    this.masterApi.get<Record<string, unknown>, DesignationRow>('master/designation', { searchText: null, isActive: null }).subscribe({ next: (r) => (this.designations.set(r), done()), error: onError });
    this.masterApi.get<Record<string, unknown>, EmployeeRow>('master/employee', { searchText: null, isActive: null }).subscribe({ next: (r) => (this.employees.set(r), done()), error: onError });
    this.masterApi.get<Record<string, unknown>, SiteRow>('master/site', { searchText: null, isActive: null }).subscribe({ next: (r) => (this.sites.set(r), done()), error: onError });
  }

  private pruneInvalidSelections(): void {
    const cleared: string[] = [];
    const checks: [string, SelectOption[]][] = [
      ['branchId', this.branchOptions()],
      ['divisionId', this.divisionOptions()],
      ['departmentId', this.departmentOptions()],
      ['costCenterId', this.costCenterOptions()],
      ['designationId', this.designationOptions()],
      ['reportingManagerId', this.reportingManagerOptions()],
    ];
    for (const [key, options] of checks) {
      const control = this.form.get(key)!;
      const value = control.value;
      if (value && !options.some((o) => o.value === value)) {
        control.setValue('');
        cleared.push(key);
      }
    }
    if (cleared.length > 0) {
      this.errorMessage.set(`Reload cleared ${cleared.length} selection(s) that are no longer valid: ${cleared.join(', ')}.`);
    } else {
      this.errorMessage.set(null);
    }
  }

  // --- Edit mode: restore Locations + Secretaries in one call ---
  private loadAssignments(employeeId: string): void {
    this.api.post<{ employeeId: string }, EmployeeAssignmentsResponse>('master/employee/assignments/get', { employeeId }).subscribe({
      next: (res) => {
        const raw = (res.data ?? { locations: [], secretaries: [] }) as unknown as { locations: Record<string, unknown>[]; secretaries: Record<string, unknown>[] };
        // CONFIRMED LIVE assignments/get returns BOTH active and inactive
        // rows — only active ones are "currently assigned".
        const locs = (raw.locations ?? [])
          .map((r) => normalizeRowKeys(r) as unknown as EmployeeLocationAssignmentDisplay & { isActive?: boolean })
          .filter((r) => r.isActive !== false);
        const secs = (raw.secretaries ?? [])
          .map((r) => normalizeRowKeys(r) as unknown as EmployeeSecretaryAssignmentDisplay & { isActive?: boolean })
          .filter((r) => r.isActive !== false);
        this.locations.set(locs);
        this.secretaries.set(secs);
        this.initialLocationsSnapshot = JSON.stringify(locs.map(locationKey).sort());
        this.initialSecretariesSnapshot = JSON.stringify(secs.map((s) => s.secretaryEmployeeId).sort());
      },
      error: () => {
        this.errorMessage.set("Couldn't load this employee's existing Location and Secretary assignments.");
      },
    });
  }

  // --- Locations tab ---
  protected onSiteChange(siteId: string): void {
    this.selectedSiteId.set(siteId);
    this.selectedAvailableKey.set(null);
    this.locationOptionsForSite.set([]);
    if (!siteId) return;
    this.locationOptionsLoading.set(true);
    this.locationOptionsError.set(false);
    const token = ++this.locationRequestToken;
    this.api.post<{ siteId: string; employeeId?: string | null }, Record<string, unknown>[]>('master/employee/location-options/get', { siteId, employeeId: this.currentEmployeeId }).subscribe({
      next: (res) => {
        // Stale-response guard — a newer Site selection must win.
        if (token !== this.locationRequestToken) return;
        this.locationOptionsLoading.set(false);
        const rows = (res.data ?? []).map((r) => normalizeRowKeys(r)) as unknown as EmployeeLocationOptionRow[];
        this.locationOptionsForSite.set(rows);
      },
      error: () => {
        if (token !== this.locationRequestToken) return;
        this.locationOptionsLoading.set(false);
        this.locationOptionsError.set(true);
      },
    });
  }

  protected selectAvailableRow(row: EmployeeLocationOptionRow): void {
    this.selectedAvailableKey.set(locationKey({ siteId: row.siteId, buildingId: row.buildingId, floorId: row.floorId, wingId: row.wingId }));
  }

  protected isAvailableRowSelected(row: EmployeeLocationOptionRow): boolean {
    return this.selectedAvailableKey() === locationKey({ siteId: row.siteId, buildingId: row.buildingId, floorId: row.floorId, wingId: row.wingId });
  }

  protected addWorkstation(row?: EmployeeLocationOptionRow): void {
    const target = row ?? this.availableWorkstationRows().find((r) => this.isAvailableRowSelected(r));
    if (!target) return;
    const key = locationKey({ siteId: target.siteId, buildingId: target.buildingId, floorId: target.floorId, wingId: target.wingId });
    if (this.locations().some((l) => locationKey(l) === key)) return; // duplicate guard
    this.locations.update((list) => [
      ...list,
      {
        siteId: target.siteId,
        buildingId: target.buildingId,
        floorId: target.floorId,
        wingId: target.wingId,
        siteCode: target.siteCode,
        siteName: target.siteName,
        buildingName: target.buildingName,
        floorName: target.floorName,
        wingName: target.wingName,
      },
    ]);
    this.selectedAvailableKey.set(null);
  }

  protected selectAssignedRow(row: EmployeeLocationAssignmentDisplay): void {
    this.selectedAssignedKey.set(locationKey(row));
  }

  protected isAssignedRowSelected(row: EmployeeLocationAssignmentDisplay): boolean {
    return this.selectedAssignedKey() === locationKey(row);
  }

  protected removeWorkstation(): void {
    const key = this.selectedAssignedKey();
    if (!key) return;
    this.locations.update((list) => list.filter((l) => locationKey(l) !== key));
    this.selectedAssignedKey.set(null);
  }

  // --- Secretaries tab ---
  protected onSecretarySearchSelect(employeeId: string): void {
    if (!employeeId) return;
    const emp = this.employees().find((e) => e.employeeId === employeeId);
    if (!emp) return;
    if (emp.employeeId === this.currentEmployeeId) return; // self-secretary guard
    if (this.secretaries().some((s) => s.secretaryEmployeeId === employeeId)) return; // duplicate guard
    this.secretaries.update((list) => [
      ...list,
      {
        secretaryEmployeeId: emp.employeeId,
        secretaryEmployeeCode: emp.employeeCode,
        secretaryEmployeeName: emp.fullName,
        secretaryEmailId: emp.emailId,
        secretaryDepartmentName: emp.departmentName,
        secretaryBranchName: emp.branchName,
        secretaryCompanyName: emp.companyName,
      },
    ]);
    this.secretarySearchValue.set('');
  }

  protected selectSecretaryRow(row: EmployeeSecretaryAssignmentDisplay): void {
    this.selectedSecretaryKey.set(row.secretaryEmployeeId);
  }

  protected isSecretaryRowSelected(row: EmployeeSecretaryAssignmentDisplay): boolean {
    return this.selectedSecretaryKey() === row.secretaryEmployeeId;
  }

  protected removeSecretary(): void {
    const key = this.selectedSecretaryKey();
    if (!key) return;
    this.secretaries.update((list) => list.filter((s) => s.secretaryEmployeeId !== key));
    this.selectedSecretaryKey.set(null);
  }

  // --- Tabs ---
  protected setTab(tab: TabKey): void {
    this.activeTab.set(tab);
  }

  onEnterKey(event: Event): void {
    handleFormEnterKey(event as KeyboardEvent);
  }

  onCancel(): void {
    this.dialogRef.close(false);
  }

  protected onCancelClick(): void {
    if (this.hasUnsavedChanges()) {
      this.dialogService
        .open(ConfirmDialogComponent, {
          width: '420px',
          data: {
            title: 'Discard unsaved changes?',
            message: 'Your changes to this employee — including any Location or Secretary assignment changes — have not been saved.',
          },
        })
        .afterClosed()
        .subscribe((confirmed) => {
          if (confirmed) this.onCancel();
        });
      return;
    }
    this.onCancel();
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.activeTab.set('details');
      return;
    }
    if (this.saving()) return;

    this.saving.set(true);
    this.errorMessage.set(null);

    const value = this.form.getRawValue();
    const payload: EmployeeSaveRequest = {
      employeeId: this.isEdit ? value.employeeId : null,
      companyId: value.companyId,
      branchId: value.branchId || null,
      divisionId: value.divisionId || null,
      departmentId: value.departmentId || null,
      costCenterId: value.costCenterId || null,
      designationId: value.designationId || null,
      employeeCode: (value.employeeCode || '').trim(),
      fullName: (value.fullName || '').trim(),
      gender: value.gender || null,
      cabinName: (value.cabinName || '').trim() || null,
      emailId: (value.emailId || '').trim() || null,
      mobileNo: (value.mobileNo || '').trim() || null,
      dateOfJoining: value.dateOfJoining || null,
      reportingManagerId: value.reportingManagerId || null,
      // Derived, always explicit — see this file's own class comment.
      secretaryFlag: this.secretaryFlag(),
      remarks: value.remarks || null,
      locations: this.locations().map((l) => ({ siteId: l.siteId, buildingId: l.buildingId ?? null, floorId: l.floorId ?? null, wingId: l.wingId ?? null })),
      secretaries: this.secretaries().map((s) => ({ secretaryEmployeeId: s.secretaryEmployeeId })),
    };

    this.api.post<EmployeeSaveRequest, { Status: number; Message: string; EmployeeId: string }[]>('master/employee/save-with-assignments', payload).subscribe({
      next: (res) => {
        this.saving.set(false);
        if (res.success) {
          this.dialogRef.close(true);
        } else {
          // Surfaces the REAL backend message verbatim, e.g. "An employee
          // cannot report to themself.", "Select each secretary once,
          // excluding the employee themself.", or "Duplicate employee
          // locations are not allowed." (this file's own class comment).
          this.errorMessage.set(usableMessage(res.message) ?? 'Failed to save this employee.');
        }
      },
      error: (err) => {
        this.saving.set(false);
        this.errorMessage.set(extractApiErrorMessage(err) ?? 'Something went wrong while saving this employee.');
      },
    });
  }
}
