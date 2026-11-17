import { Component, Inject, OnInit, computed, inject, signal } from '@angular/core';
import { AbstractControl, FormControl, FormGroup, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { DIALOG_DATA } from '../../../shared/ui/dialog/dialog-data.token';
import { DialogRef } from '../../../shared/ui/dialog/dialog-ref';
import { DialogService } from '../../../shared/ui/dialog/dialog.service';
import { ConfirmDialogComponent } from '../shared/confirm-dialog.component';
import { MasterApiService } from '../shared/master-api.service';
import { DesignationRow, DesignationSaveRequest } from './designation.model';
import { CompanyRow } from '../company/company.model';
import { extractApiErrorMessage, usableMessage } from '../../../core/utils/api-error.util';
import { handleFormEnterKey } from '../../../core/utils/form-keyboard.util';
import { ButtonComponent } from '../../../shared/ui/button/button.component';
import { InputComponent } from '../../../shared/ui/form/input.component';
import { TextareaComponent } from '../../../shared/ui/form/textarea.component';
import { ComboboxComponent } from '../../../shared/ui/form/combobox.component';
import { CheckboxComponent } from '../../../shared/ui/form/checkbox.component';
import { SelectOption } from '../../../shared/ui/form/select.component';

export interface DesignationFormDialogData {
  row: DesignationRow | null; // null for 'add', present for 'edit'
  mode: 'add' | 'edit';
}

export type DesignationFormDialogResult = boolean;

// Integer-only validator — CONFIRMED LIVE the real backend rejects a
// decimal designationLevel with a hard JSON type error, not a graceful
// business-rule message (see designation.model.ts's own class-level
// comment) — this control must never let a decimal value be submitted.
function integerValidator(control: AbstractControl): ValidationErrors | null {
  const raw = control.value;
  if (raw === '' || raw == null) return null;
  return /^-?\d+$/.test(String(raw)) ? null : { integer: true };
}

// Add/Edit Designation — not MasterFormDialogComponent-driven. Same
// "generic dialog chrome mismatch" reasoning as Cost Center/Division/
// Department Master's own rebuilds this session (single-level Company
// dependency, not a cascading one).
//
// CONFIRMED LIVE — "Specify level" is a pure UI convenience, not a real
// backend field: the real DesignationRequest schema has only a single
// plain nullable int32 designationLevel, no separate boolean anywhere.
// Checked -> send the real number typed, including 0 or a negative
// integer (both CONFIRMED LIVE as valid, persisted, distinct values).
// Unchecked -> send null explicitly, never a silently-coerced 0 (this
// task's own explicit warning, now CONFIRMED null and 0 are genuinely
// different, independently valid backend states).
@Component({
  selector: 'app-designation-form-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, ButtonComponent, InputComponent, TextareaComponent, ComboboxComponent, CheckboxComponent],
  templateUrl: './designation-form-dialog.component.html',
  styleUrl: './designation-form-dialog.component.scss',
})
export class DesignationFormDialogComponent implements OnInit {
  private readonly masterApi = inject(MasterApiService);
  private readonly dialogService = inject(DialogService);
  protected readonly dialogRef = inject(DialogRef<DesignationFormDialogResult>);

  protected readonly isEdit: boolean;
  protected readonly saving = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly form: FormGroup;

  protected readonly companiesLoading = signal(true);
  protected readonly companiesError = signal(false);

  // The row's own saved Company is preserved as selectable even if no
  // longer active by the time this dialog opens for Edit — same
  // "preserve existing relationships" pattern as every other Master's
  // own rebuild this session.
  private savedCompanyOption: CompanyRow | null = null;
  private readonly eligibleCompanies = signal<CompanyRow[]>([]);

  protected readonly companyOptions = computed<SelectOption[]>(() => {
    const options = this.eligibleCompanies().map((c) => this.toCompanyOption(c));
    if (this.savedCompanyOption && !this.eligibleCompanies().some((c) => c.companyId === this.savedCompanyOption!.companyId)) {
      options.unshift(this.toCompanyOption(this.savedCompanyOption));
    }
    return options;
  });

  // Plain signals set explicitly from valueChanges, NOT a computed()
  // reading a FormControl's .value/.disabled directly — the established
  // anti-pattern this session (see this file's own constructor for the
  // subscriptions that keep these in sync).
  protected readonly selectedCompanyId = signal<string>('');
  protected readonly specifyLevelChecked = signal<boolean>(true);

  protected readonly helperText = computed(() => (this.selectedCompanyId() ? 'Ready' : 'Select Company, then enter the Designation details.'));

  constructor(@Inject(DIALOG_DATA) public data: DesignationFormDialogData) {
    this.isEdit = data.mode === 'edit';
    const row = data.row;

    // Edit mode: checked only when the saved row actually carries a real
    // level (including 0/negative) — unchecked when it's null. Add mode:
    // checked by default, per this task's own screenshot.
    const initialSpecifyLevel = row ? row.designationLevel != null : true;

    this.form = new FormGroup({
      designationId: new FormControl(row?.designationId ?? null),
      companyId: new FormControl(row?.companyId ?? '', [Validators.required]),
      designationCode: new FormControl(row?.designationCode ?? '', [Validators.required, Validators.maxLength(50)]),
      designationName: new FormControl(row?.designationName ?? '', [Validators.required, Validators.maxLength(200)]),
      specifyLevel: new FormControl(initialSpecifyLevel),
      designationLevel: new FormControl(row?.designationLevel != null ? String(row.designationLevel) : '', [integerValidator]),
      // Always blank, including on Edit — same confirmed-live
      // write-only-per-action changelog behavior as every other Master's
      // own remarks fields this session.
      remarks: new FormControl(''),
    });

    this.form.get('companyId')!.valueChanges.subscribe((companyId: string) => {
      this.selectedCompanyId.set(companyId);
    });
    this.selectedCompanyId.set(this.form.get('companyId')!.value);

    this.form.get('specifyLevel')!.valueChanges.subscribe((checked: boolean) => {
      this.specifyLevelChecked.set(checked);
      this.syncControlEnabled(this.form.get('designationLevel')!, checked);
    });
    this.specifyLevelChecked.set(initialSpecifyLevel);
    this.syncControlEnabled(this.form.get('designationLevel')!, initialSpecifyLevel);
  }

  ngOnInit(): void {
    this.loadCompanies();
  }

  private syncControlEnabled(control: AbstractControl, shouldBeEnabled: boolean): void {
    if (shouldBeEnabled) {
      if (control.disabled) control.enable({ emitEvent: false });
    } else if (control.enabled) {
      control.disable({ emitEvent: false });
    }
  }

  private toCompanyOption(c: CompanyRow): SelectOption {
    return { label: c.companyCode ? `${c.companyName} (${c.companyCode})` : (c.companyName ?? ''), value: c.companyId };
  }

  private loadCompanies(): void {
    this.companiesLoading.set(true);
    this.companiesError.set(false);
    this.masterApi.get<Record<string, unknown>, CompanyRow>('master/company', { searchText: null, isActive: null }).subscribe({
      next: (companies) => {
        this.companiesLoading.set(false);
        // Only active companies — same "follow actual backend eligibility
        // rules for active/inactive Companies" pattern as every other
        // Master's own rebuild this session.
        this.eligibleCompanies.set(companies.filter((c) => c.isActive));
        const savedId = this.data.row?.companyId;
        if (savedId) this.savedCompanyOption = companies.find((c) => c.companyId === savedId) ?? null;
      },
      error: () => {
        this.companiesLoading.set(false);
        this.companiesError.set(true);
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
    const specifyLevel: boolean = value.specifyLevel;
    // CONFIRMED LIVE null and 0 are distinct, independently valid
    // backend states — never coerce an unchecked "Specify level" into 0,
    // and never use `||`/truthy coercion on the typed value itself
    // (0 is falsy but a real, valid level).
    const levelRaw: string = value.designationLevel;
    const designationLevel = !specifyLevel || levelRaw === '' || levelRaw == null ? null : Number(levelRaw);

    const payload: DesignationSaveRequest = {
      designationId: this.isEdit ? value.designationId : null,
      companyId: value.companyId,
      designationCode: (value.designationCode || '').trim(),
      designationName: (value.designationName || '').trim(),
      designationLevel: designationLevel != null && Number.isNaN(designationLevel) ? null : designationLevel,
      remarks: value.remarks || null,
    };

    const request$ = this.isEdit ? this.masterApi.edit('master/designation', payload) : this.masterApi.add('master/designation', payload);
    request$.subscribe({
      next: (res) => {
        this.saving.set(false);
        if (res.success) {
          this.dialogRef.close(true);
        } else {
          this.errorMessage.set(usableMessage(res.message) ?? 'Failed to save this designation.');
        }
      },
      error: (err) => {
        this.saving.set(false);
        this.errorMessage.set(extractApiErrorMessage(err) ?? 'Something went wrong while saving this designation.');
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
            message: 'Your changes to this designation have not been saved.',
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
