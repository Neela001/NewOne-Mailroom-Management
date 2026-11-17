import { Component, Inject, OnInit, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { DIALOG_DATA } from '../../../shared/ui/dialog/dialog-data.token';
import { DialogRef } from '../../../shared/ui/dialog/dialog-ref';
import { DialogService } from '../../../shared/ui/dialog/dialog.service';
import { ConfirmDialogComponent } from '../shared/confirm-dialog.component';
import { MasterApiService } from '../shared/master-api.service';
import { CostCenterRow, CostCenterSaveRequest } from './costcenter.model';
import { CompanyRow } from '../company/company.model';
import { extractApiErrorMessage, usableMessage } from '../../../core/utils/api-error.util';
import { handleFormEnterKey } from '../../../core/utils/form-keyboard.util';
import { ButtonComponent } from '../../../shared/ui/button/button.component';
import { InputComponent } from '../../../shared/ui/form/input.component';
import { TextareaComponent } from '../../../shared/ui/form/textarea.component';
import { ComboboxComponent } from '../../../shared/ui/form/combobox.component';
import { SelectOption } from '../../../shared/ui/form/select.component';

export interface CostCenterFormDialogData {
  row: CostCenterRow | null; // null for 'add', present for 'edit'
  mode: 'add' | 'edit';
}

export type CostCenterFormDialogResult = boolean;

// Add/Edit Cost Center — not MasterFormDialogComponent-driven. See
// costcenter-list.component.ts's own comment for why.
//
// CONFIRMED LIVE the backend itself enforces duplicate Cost Center Code
// validation — never a frontend-only check invented here; onSubmit()
// simply surfaces whatever real message the backend returns through this
// dialog's own errorMessage signal.
@Component({
  selector: 'app-costcenter-form-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, ButtonComponent, InputComponent, TextareaComponent, ComboboxComponent],
  templateUrl: './costcenter-form-dialog.component.html',
  styleUrl: './costcenter-form-dialog.component.scss',
})
export class CostCenterFormDialogComponent implements OnInit {
  private readonly masterApi = inject(MasterApiService);
  private readonly dialogService = inject(DialogService);
  protected readonly dialogRef = inject(DialogRef<CostCenterFormDialogResult>);

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

  // A plain signal set explicitly, NOT a computed() reading
  // form.get('companyId')!.value directly — see uploadfiles-upload-
  // dialog.component.ts's own comment this session for why a computed()
  // reading a FormControl's plain .value would cache its first result
  // forever.
  protected readonly selectedCompanyId = signal<string>('');

  // Dynamic footer guidance — this task's own explicit "Status/helper
  // message area (for example, Ready)" instruction.
  protected readonly helperText = computed(() => (this.selectedCompanyId() ? 'Ready' : 'Select Company, then enter the Cost Center details.'));

  constructor(@Inject(DIALOG_DATA) public data: CostCenterFormDialogData) {
    this.isEdit = data.mode === 'edit';
    const row = data.row;

    this.form = new FormGroup({
      costCenterId: new FormControl(row?.costCenterId ?? null),
      companyId: new FormControl(row?.companyId ?? '', [Validators.required]),
      costCenterCode: new FormControl(row?.costCenterCode ?? '', [Validators.required, Validators.maxLength(50)]),
      costCenterName: new FormControl(row?.costCenterName ?? '', [Validators.required, Validators.maxLength(200)]),
      // Always blank, including on Edit — same confirmed-live
      // write-only-per-action changelog behavior as every other Master's
      // own remarks fields this session.
      remarks: new FormControl(''),
    });

    this.form.get('companyId')!.valueChanges.subscribe((companyId: string) => {
      this.selectedCompanyId.set(companyId);
    });
    this.selectedCompanyId.set(this.form.get('companyId')!.value);
  }

  ngOnInit(): void {
    this.loadCompanies();
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
        // Only active companies — "Follow actual backend eligibility
        // rules for active/inactive Companies" (this task's own
        // Section 3).
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
    const payload: CostCenterSaveRequest = {
      costCenterId: this.isEdit ? value.costCenterId : null,
      companyId: value.companyId,
      // Trim leading/trailing spaces — this task's own Section 4.
      costCenterCode: (value.costCenterCode || '').trim(),
      costCenterName: (value.costCenterName || '').trim(),
      remarks: value.remarks || null,
    };

    const request$ = this.isEdit ? this.masterApi.edit('master/costcenter', payload) : this.masterApi.add('master/costcenter', payload);
    request$.subscribe({
      next: (res) => {
        this.saving.set(false);
        if (res.success) {
          this.dialogRef.close(true);
        } else {
          // Surfaces the REAL backend message here, e.g. "Duplicate record
          // already exists." (this file's own class-level comment).
          this.errorMessage.set(usableMessage(res.message) ?? 'Failed to save this cost center.');
        }
      },
      error: (err) => {
        this.saving.set(false);
        this.errorMessage.set(extractApiErrorMessage(err) ?? 'Something went wrong while saving this cost center.');
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
            message: 'Your changes to this cost center have not been saved.',
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
