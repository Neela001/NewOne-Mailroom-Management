import { Component, Inject, OnInit, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { DIALOG_DATA } from '../../../shared/ui/dialog/dialog-data.token';
import { DialogRef } from '../../../shared/ui/dialog/dialog-ref';
import { DialogService } from '../../../shared/ui/dialog/dialog.service';
import { ConfirmDialogComponent } from '../shared/confirm-dialog.component';
import { MasterApiService } from '../shared/master-api.service';
import { CompanyRow, CompanySaveRequest } from './company.model';
import { CompanyGroupRow } from '../companygroup/companygroup.model';
import { extractApiErrorMessage, usableMessage } from '../../../core/utils/api-error.util';
import { handleFormEnterKey } from '../../../core/utils/form-keyboard.util';
import { ButtonComponent } from '../../../shared/ui/button/button.component';
import { InputComponent } from '../../../shared/ui/form/input.component';
import { TextareaComponent } from '../../../shared/ui/form/textarea.component';
import { ComboboxComponent } from '../../../shared/ui/form/combobox.component';
import { SelectOption } from '../../../shared/ui/form/select.component';

export interface CompanyFormDialogData {
  row: CompanyRow | null; // null for 'add', present for 'edit'
  mode: 'add' | 'edit';
}

export type CompanyFormDialogResult = boolean;

// Add/Edit Company — not MasterFormDialogComponent-driven. See
// company-list.component.ts's own comment for why.
//
// CONFIRMED LIVE (important gap): the real CompanyRequest's own
// companyGroupId is nullable and NOT required server-side — a real
// master/company/add probe that omitted it entirely succeeded. This
// task's own brief explicitly requires Company Group to be mandatory in
// the UI regardless ("Do not allow saving without a valid Company Group
// selection") — implemented here as a real Validators.required, a
// deliberate UI-stricter-than-API choice, not an invented backend rule.
// See company.model.ts's own comment and this module's final report for
// the full writeup of this gap.
@Component({
  selector: 'app-company-form-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, ButtonComponent, InputComponent, TextareaComponent, ComboboxComponent],
  templateUrl: './company-form-dialog.component.html',
  styleUrl: './company-form-dialog.component.scss',
})
export class CompanyFormDialogComponent implements OnInit {
  private readonly masterApi = inject(MasterApiService);
  private readonly dialogService = inject(DialogService);
  protected readonly dialogRef = inject(DialogRef<CompanyFormDialogResult>);

  protected readonly isEdit: boolean;
  protected readonly saving = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly form: FormGroup;

  protected readonly companyGroupsLoading = signal(true);
  protected readonly companyGroupsError = signal(false);

  // The row's own saved Company Group is preserved as selectable even if
  // no longer active by the time this dialog opens for Edit — same
  // "preserve existing relationships" pattern as every other Master's
  // own rebuild this session.
  private savedCompanyGroupOption: CompanyGroupRow | null = null;
  private readonly eligibleCompanyGroups = signal<CompanyGroupRow[]>([]);

  protected readonly companyGroupOptions = computed<SelectOption[]>(() => {
    const options = this.eligibleCompanyGroups().map((g) => this.toCompanyGroupOption(g));
    if (this.savedCompanyGroupOption && !this.eligibleCompanyGroups().some((g) => g.companyGroupId === this.savedCompanyGroupOption!.companyGroupId)) {
      options.unshift(this.toCompanyGroupOption(this.savedCompanyGroupOption));
    }
    return options;
  });

  constructor(@Inject(DIALOG_DATA) public data: CompanyFormDialogData) {
    this.isEdit = data.mode === 'edit';
    const row = data.row;

    this.form = new FormGroup({
      companyId: new FormControl(row?.companyId ?? null),
      companyGroupId: new FormControl(row?.companyGroupId ?? '', [Validators.required]),
      companyCode: new FormControl(row?.companyCode ?? '', [Validators.required, Validators.maxLength(50)]),
      companyName: new FormControl(row?.companyName ?? '', [Validators.required, Validators.maxLength(200)]),
      legalName: new FormControl(row?.legalName ?? '', [Validators.maxLength(200)]),
      registrationNo: new FormControl(row?.registrationNo ?? '', [Validators.maxLength(100)]),
      taxRegistrationNo: new FormControl(row?.taxRegistrationNo ?? '', [Validators.maxLength(100)]),
      // Always blank, including on Edit — same confirmed-live
      // write-only-per-action changelog behavior as every other Master's
      // own remarks fields this session.
      remarks: new FormControl(''),
    });
  }

  ngOnInit(): void {
    this.loadCompanyGroups();
  }

  private toCompanyGroupOption(g: CompanyGroupRow): SelectOption {
    return { label: g.companyGroupCode ? `${g.companyGroupName} (${g.companyGroupCode})` : (g.companyGroupName ?? ''), value: g.companyGroupId };
  }

  private loadCompanyGroups(): void {
    this.companyGroupsLoading.set(true);
    this.companyGroupsError.set(false);
    this.masterApi.get<Record<string, unknown>, CompanyGroupRow>('master/companygroup', { searchText: null, isActive: null }).subscribe({
      next: (groups) => {
        this.companyGroupsLoading.set(false);
        // Only active Company Groups — "Follow actual backend eligibility
        // rules for active/inactive groups" (this task's own Section 3).
        this.eligibleCompanyGroups.set(groups.filter((g) => g.isActive));
        const savedId = this.data.row?.companyGroupId;
        if (savedId) this.savedCompanyGroupOption = groups.find((g) => g.companyGroupId === savedId) ?? null;
      },
      error: () => {
        this.companyGroupsLoading.set(false);
        this.companyGroupsError.set(true);
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
    const payload: CompanySaveRequest = {
      companyId: this.isEdit ? value.companyId : null,
      companyGroupId: value.companyGroupId,
      // Trim leading/trailing spaces — this task's own Section 4.
      companyCode: (value.companyCode || '').trim(),
      companyName: (value.companyName || '').trim(),
      legalName: (value.legalName || '').trim() || null,
      registrationNo: (value.registrationNo || '').trim() || null,
      taxRegistrationNo: (value.taxRegistrationNo || '').trim() || null,
      remarks: value.remarks || null,
    };

    const request$ = this.isEdit ? this.masterApi.edit('master/company', payload) : this.masterApi.add('master/company', payload);
    request$.subscribe({
      next: (res) => {
        this.saving.set(false);
        if (res.success) {
          this.dialogRef.close(true);
        } else {
          this.errorMessage.set(usableMessage(res.message) ?? 'Failed to save this company.');
        }
      },
      error: (err) => {
        this.saving.set(false);
        this.errorMessage.set(extractApiErrorMessage(err) ?? 'Something went wrong while saving this company.');
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
            message: 'Your changes to this company have not been saved.',
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
