import { Component, Inject, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { DIALOG_DATA } from '../../../shared/ui/dialog/dialog-data.token';
import { DialogRef } from '../../../shared/ui/dialog/dialog-ref';
import { DialogService } from '../../../shared/ui/dialog/dialog.service';
import { ConfirmDialogComponent } from '../shared/confirm-dialog.component';
import { MasterApiService } from '../shared/master-api.service';
import { CompanyGroupRow, CompanyGroupSaveRequest } from './companygroup.model';
import { extractApiErrorMessage, usableMessage } from '../../../core/utils/api-error.util';
import { handleFormEnterKey } from '../../../core/utils/form-keyboard.util';
import { ButtonComponent } from '../../../shared/ui/button/button.component';
import { InputComponent } from '../../../shared/ui/form/input.component';
import { TextareaComponent } from '../../../shared/ui/form/textarea.component';

export interface CompanyGroupFormDialogData {
  row: CompanyGroupRow | null; // null for 'add', present for 'edit'
  mode: 'add' | 'edit';
}

export type CompanyGroupFormDialogResult = boolean;

// Add/Edit Company Group — not MasterFormDialogComponent-driven. See
// companygroup-list.component.ts's own comment for why: not a cascading-
// dropdown mismatch like every other location Master this session, but a
// real mismatch in the generic dialog's own fixed header/footer chrome
// (no subtitle, no footer helper text, hardcoded "Close"/"Save" button
// labels) versus this task's own explicit copy requirements.
//
// CONFIRMED LIVE the backend itself enforces duplicate Company Group Code
// uniqueness ("Duplicate record already exists.") — never a frontend-only
// check invented here; onSubmit() simply surfaces whatever real message
// the backend returns through this dialog's own errorMessage signal.
@Component({
  selector: 'app-companygroup-form-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, ButtonComponent, InputComponent, TextareaComponent],
  templateUrl: './companygroup-form-dialog.component.html',
  styleUrl: './companygroup-form-dialog.component.scss',
})
export class CompanyGroupFormDialogComponent {
  private readonly masterApi = inject(MasterApiService);
  private readonly dialogService = inject(DialogService);
  protected readonly dialogRef = inject(DialogRef<CompanyGroupFormDialogResult>);

  protected readonly isEdit: boolean;
  protected readonly saving = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly form: FormGroup;

  constructor(@Inject(DIALOG_DATA) public data: CompanyGroupFormDialogData) {
    this.isEdit = data.mode === 'edit';
    const row = data.row;

    this.form = new FormGroup({
      companyGroupId: new FormControl(row?.companyGroupId ?? null),
      companyGroupCode: new FormControl(row?.companyGroupCode ?? '', [Validators.required, Validators.maxLength(50)]),
      companyGroupName: new FormControl(row?.companyGroupName ?? '', [Validators.required, Validators.maxLength(200)]),
      // Always blank, including on Edit — same confirmed-live
      // write-only-per-action changelog behavior as every other Master's
      // own remarks fields this session.
      remarks: new FormControl(''),
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
    const payload: CompanyGroupSaveRequest = {
      companyGroupId: this.isEdit ? value.companyGroupId : null,
      // Trim leading/trailing spaces — this task's own Section 3.
      companyGroupCode: (value.companyGroupCode || '').trim(),
      companyGroupName: (value.companyGroupName || '').trim(),
      remarks: value.remarks || null,
    };

    const request$ = this.isEdit ? this.masterApi.edit('master/companygroup', payload) : this.masterApi.add('master/companygroup', payload);
    request$.subscribe({
      next: (res) => {
        this.saving.set(false);
        if (res.success) {
          this.dialogRef.close(true);
        } else {
          // Surfaces the REAL backend message here, e.g. "Duplicate record
          // already exists." (this file's own class-level comment).
          this.errorMessage.set(usableMessage(res.message) ?? 'Failed to save this company group.');
        }
      },
      error: (err) => {
        this.saving.set(false);
        this.errorMessage.set(extractApiErrorMessage(err) ?? 'Something went wrong while saving this company group.');
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
            message: 'Your changes to this company group have not been saved.',
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
