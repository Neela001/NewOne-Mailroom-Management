import { Component, Inject, OnInit, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { DIALOG_DATA } from '../../../shared/ui/dialog/dialog-data.token';
import { DialogRef } from '../../../shared/ui/dialog/dialog-ref';
import { DialogService } from '../../../shared/ui/dialog/dialog.service';
import { ConfirmDialogComponent } from '../shared/confirm-dialog.component';
import { MasterApiService } from '../shared/master-api.service';
import { DepartmentRow, DepartmentSaveRequest } from './department.model';
import { CompanyRow } from '../company/company.model';
import { DivisionRow } from '../division/division.model';
import { extractApiErrorMessage, usableMessage } from '../../../core/utils/api-error.util';
import { handleFormEnterKey } from '../../../core/utils/form-keyboard.util';
import { ButtonComponent } from '../../../shared/ui/button/button.component';
import { InputComponent } from '../../../shared/ui/form/input.component';
import { TextareaComponent } from '../../../shared/ui/form/textarea.component';
import { ComboboxComponent } from '../../../shared/ui/form/combobox.component';
import { SelectOption } from '../../../shared/ui/form/select.component';

export interface DepartmentFormDialogData {
  row: DepartmentRow | null; // null for 'add', present for 'edit'
  mode: 'add' | 'edit';
}

export type DepartmentFormDialogResult = boolean;

// Add/Edit Department — not MasterFormDialogComponent-driven. See
// department-list.component.ts's own comment for why. This dialog's own
// reasons for being dedicated:
//   - Company -> Division dependency: Division dropdown disabled until a
//     Company is selected, then client-side filtered to that Company's
//     own real divisions — CONFIRMED LIVE DivisionGetRequest has no
//     companyId filter param (same finding as every cascading dropdown
//     this session), so this is a client-side filter over one real
//     master/division/get fetch.
//   - CONFIRMED LIVE Division really is required server-side here
//     (unlike Company Group on Company Master this session) — a real
//     probe that omitted divisionId was rejected with "DivisionId is
//     required." — no UI-vs-API gap to report.
//   - CONFIRMED LIVE the backend enforces duplicate Department Code
//     validation — never a frontend-only check invented here; onSubmit()
//     surfaces whatever real message the backend returns.
//   - Company change clears Division and reloads its own options (this
//     task's own "Dependency reset rules").
@Component({
  selector: 'app-department-form-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, ButtonComponent, InputComponent, TextareaComponent, ComboboxComponent],
  templateUrl: './department-form-dialog.component.html',
  styleUrl: './department-form-dialog.component.scss',
})
export class DepartmentFormDialogComponent implements OnInit {
  private readonly masterApi = inject(MasterApiService);
  private readonly dialogService = inject(DialogService);
  protected readonly dialogRef = inject(DialogRef<DepartmentFormDialogResult>);

  protected readonly isEdit: boolean;
  protected readonly saving = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly form: FormGroup;

  protected readonly companiesLoading = signal(true);
  protected readonly companiesError = signal(false);
  protected readonly divisionsLoading = signal(true);
  protected readonly divisionsError = signal(false);

  // Preserve saved-but-now-ineligible selections on Edit — same pattern
  // as every other location/organization Master's own rebuild this
  // session.
  private savedCompanyOption: CompanyRow | null = null;
  private savedDivisionOption: DivisionRow | null = null;
  private readonly eligibleCompanies = signal<CompanyRow[]>([]);
  private readonly allDivisions = signal<DivisionRow[]>([]);

  protected readonly companyOptions = computed<SelectOption[]>(() => {
    const options = this.eligibleCompanies().map((c) => this.toCompanyOption(c));
    if (this.savedCompanyOption && !this.eligibleCompanies().some((c) => c.companyId === this.savedCompanyOption!.companyId)) {
      options.unshift(this.toCompanyOption(this.savedCompanyOption));
    }
    return options;
  });

  // A plain signal set explicitly, NOT a computed() reading
  // form.get('companyId')!.value directly — see uploadfiles-upload-
  // dialog.component.ts's own comment this session for why a computed()
  // reading a FormControl's plain .value would cache its first result
  // forever.
  protected readonly selectedCompanyId = signal<string>('');

  protected readonly divisionOptions = computed<SelectOption[]>(() => {
    const companyId = this.selectedCompanyId();
    if (!companyId) return [];
    const filtered = this.allDivisions().filter((d) => d.companyId === companyId && d.isActive);
    const options = filtered.map((d) => this.toDivisionOption(d));
    if (this.savedDivisionOption && this.savedDivisionOption.companyId === companyId && !filtered.some((d) => d.divisionId === this.savedDivisionOption!.divisionId)) {
      options.unshift(this.toDivisionOption(this.savedDivisionOption));
    }
    return options;
  });

  // A plain signal set explicitly from divisionId's own valueChanges, NOT
  // a computed() reading form.get('divisionId')!.value directly — same
  // reasoning as selectedCompanyId above.
  protected readonly selectedDivisionId = signal<string>('');

  // Dynamic footer guidance — this task's own explicit "Status/helper
  // message area (for example, 'Select Company and Division.')"
  // instruction.
  protected readonly helperText = computed(() => {
    if (!this.selectedCompanyId() || !this.selectedDivisionId()) return 'Select Company and Division.';
    return 'Ready';
  });

  constructor(@Inject(DIALOG_DATA) public data: DepartmentFormDialogData) {
    this.isEdit = data.mode === 'edit';
    const row = data.row;

    this.form = new FormGroup({
      departmentId: new FormControl(row?.departmentId ?? null),
      companyId: new FormControl(row?.companyId ?? '', [Validators.required]),
      divisionId: new FormControl(row?.divisionId ?? '', [Validators.required]),
      departmentCode: new FormControl(row?.departmentCode ?? '', [Validators.required, Validators.maxLength(50)]),
      departmentName: new FormControl(row?.departmentName ?? '', [Validators.required, Validators.maxLength(200)]),
      // Always blank, including on Edit — same confirmed-live
      // write-only-per-action changelog behavior as every other Master's
      // own remarks fields this session.
      remarks: new FormControl(''),
    });

    // Starts disabled — "Division dropdown: Initially disabled until a
    // valid Company is selected" (this task's own Section 3).
    this.form.get('divisionId')!.disable({ emitEvent: false });

    // Registered AFTER the initial values above, so restoring a saved
    // row's own companyId on Edit does not immediately clear its own
    // already-correct divisionId — only a genuine, later user-driven
    // change should do that.
    this.form.get('companyId')!.valueChanges.subscribe((companyId: string) => {
      this.applySelectedCompany(companyId, true);
    });
    this.form.get('divisionId')!.valueChanges.subscribe((divisionId: string) => {
      this.selectedDivisionId.set(divisionId);
    });
    this.selectedDivisionId.set(this.form.get('divisionId')!.value);
  }

  ngOnInit(): void {
    this.loadCompanies();
    this.loadDivisions();
  }

  private toCompanyOption(c: CompanyRow): SelectOption {
    return { label: c.companyCode ? `${c.companyName} (${c.companyCode})` : (c.companyName ?? ''), value: c.companyId };
  }

  private toDivisionOption(d: DivisionRow): SelectOption {
    return { label: d.divisionCode ? `${d.divisionName} (${d.divisionCode})` : (d.divisionName ?? ''), value: d.divisionId };
  }

  private applySelectedCompany(companyId: string, resetDivision: boolean): void {
    this.selectedCompanyId.set(companyId);

    // Synchronous, not an effect() reacting to a computed signal later —
    // a form control's own enabled state should change in lockstep with
    // the action that caused it (see city-form-dialog.component.ts's own
    // comment this session for the async-effect() timing bug this
    // avoids).
    const divisionControl = this.form.get('divisionId')!;
    if (companyId) {
      if (divisionControl.disabled) divisionControl.enable({ emitEvent: false });
    } else if (divisionControl.enabled) {
      divisionControl.disable({ emitEvent: false });
    }

    if (resetDivision) {
      // Company changed — clear Division and reload its own options (this
      // task's own "Dependency reset rules": "Clear the selected
      // Division... Load Divisions belonging to the newly selected
      // Company").
      divisionControl.setValue('', { emitEvent: false });
      this.selectedDivisionId.set('');
    }
  }

  private loadCompanies(): void {
    this.companiesLoading.set(true);
    this.companiesError.set(false);
    this.masterApi.get<Record<string, unknown>, CompanyRow>('master/company', { searchText: null, isActive: null }).subscribe({
      next: (companies) => {
        this.companiesLoading.set(false);
        this.eligibleCompanies.set(companies.filter((c) => c.isActive));
        const savedId = this.data.row?.companyId;
        if (savedId) this.savedCompanyOption = companies.find((c) => c.companyId === savedId) ?? null;
        const currentCompanyId = this.form.get('companyId')!.value;
        if (currentCompanyId) this.applySelectedCompany(currentCompanyId, false);
      },
      error: () => {
        this.companiesLoading.set(false);
        this.companiesError.set(true);
      },
    });
  }

  private loadDivisions(): void {
    this.divisionsLoading.set(true);
    this.divisionsError.set(false);
    this.masterApi.get<Record<string, unknown>, DivisionRow>('master/division', { searchText: null, isActive: null }).subscribe({
      next: (divisions) => {
        this.divisionsLoading.set(false);
        this.allDivisions.set(divisions);
        const savedId = this.data.row?.divisionId;
        if (savedId) this.savedDivisionOption = divisions.find((d) => d.divisionId === savedId) ?? null;
      },
      error: () => {
        this.divisionsLoading.set(false);
        this.divisionsError.set(true);
      },
    });
  }

  onCancel(): void {
    this.dialogRef.close(false);
  }

  onEnterKey(event: Event): void {
    handleFormEnterKey(event as KeyboardEvent);
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    if (this.saving()) return;

    this.saving.set(true);
    this.errorMessage.set(null);

    const value = this.form.getRawValue();
    const payload: DepartmentSaveRequest = {
      departmentId: this.isEdit ? value.departmentId : null,
      companyId: value.companyId,
      divisionId: value.divisionId,
      // Trim leading/trailing spaces — this task's own Section 4.
      departmentCode: (value.departmentCode || '').trim(),
      departmentName: (value.departmentName || '').trim(),
      remarks: value.remarks || null,
    };

    const request$ = this.isEdit ? this.masterApi.edit('master/department', payload) : this.masterApi.add('master/department', payload);
    request$.subscribe({
      next: (res) => {
        this.saving.set(false);
        if (res.success) {
          this.dialogRef.close(true);
        } else {
          // Surfaces the REAL backend message here, e.g. "Duplicate record
          // already exists." (this file's own class-level comment).
          this.errorMessage.set(usableMessage(res.message) ?? 'Failed to save this department.');
        }
      },
      error: (err) => {
        this.saving.set(false);
        this.errorMessage.set(extractApiErrorMessage(err) ?? 'Something went wrong while saving this department.');
      },
    });
  }

  // Cancel should warn about unsaved changes — this dialog's own form
  // starts untouched (Add) or matching the saved row exactly (Edit, aside
  // from Remarks, which always starts blank — see this file's own
  // constructor comment for why), so form.dirty reliably reflects real
  // unsaved work either way.
  protected onCancelClick(): void {
    if (this.form.dirty) {
      this.dialogService
        .open(ConfirmDialogComponent, {
          width: '420px',
          data: {
            title: 'Discard unsaved changes?',
            message: 'Your changes to this department have not been saved.',
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
}
