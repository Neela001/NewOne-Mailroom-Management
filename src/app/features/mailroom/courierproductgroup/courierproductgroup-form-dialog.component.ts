import { Component, Inject, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { DIALOG_DATA } from '../../../shared/ui/dialog/dialog-data.token';
import { DialogRef } from '../../../shared/ui/dialog/dialog-ref';
import { DialogService } from '../../../shared/ui/dialog/dialog.service';
import { ConfirmDialogComponent } from '../../master/shared/confirm-dialog.component';
import { MasterApiService } from '../../master/shared/master-api.service';
import { CourierProductGroupRow, CourierProductGroupSaveRequest } from './courierproductgroup.model';
import { extractApiErrorMessage, usableMessage } from '../../../core/utils/api-error.util';
import { handleFormEnterKey } from '../../../core/utils/form-keyboard.util';
import { ButtonComponent } from '../../../shared/ui/button/button.component';
import { InputComponent } from '../../../shared/ui/form/input.component';
import { TextareaComponent } from '../../../shared/ui/form/textarea.component';

export interface CourierProductGroupFormDialogData {
  row: CourierProductGroupRow | null; // null for 'add', present for 'edit'
  mode: 'add' | 'edit';
}

export type CourierProductGroupFormDialogResult = boolean;

// Add/Edit Courier Product Group — not MasterFormDialogComponent-driven.
// See courierproductgroup-list.component.ts's own comment for why.
//
// CONFIRMED LIVE the backend itself enforces Code uniqueness
// (case-insensitively) and genuinely persists Change Remarks to history
// (courierproductgroup.model.ts's own class-level comment) — never a
// frontend-only check invented here; onSubmit() simply surfaces whatever
// real message the backend returns through this dialog's own
// errorMessage signal.
@Component({
  selector: 'app-courierproductgroup-form-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, ButtonComponent, InputComponent, TextareaComponent],
  templateUrl: './courierproductgroup-form-dialog.component.html',
  styleUrl: './courierproductgroup-form-dialog.component.scss',
})
export class CourierProductGroupFormDialogComponent {
  private readonly masterApi = inject(MasterApiService);
  private readonly dialogService = inject(DialogService);
  protected readonly dialogRef = inject(DialogRef<CourierProductGroupFormDialogResult>);

  protected readonly isEdit: boolean;
  protected readonly saving = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly form: FormGroup;

  // This task's own explicit helper text, shown throughout (no dynamic
  // dependency to react to here — a simple, constant line).
  protected readonly helperText = 'Enter code and name. Remarks are saved in history.';

  constructor(@Inject(DIALOG_DATA) public data: CourierProductGroupFormDialogData) {
    this.isEdit = data.mode === 'edit';
    const row = data.row;

    this.form = new FormGroup({
      courierProductGroupId: new FormControl(row?.courierProductGroupId ?? null),
      code: new FormControl(row?.code ?? '', [Validators.required, Validators.maxLength(50)]),
      name: new FormControl(row?.name ?? '', [Validators.required, Validators.maxLength(200)]),
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
    const payload: CourierProductGroupSaveRequest = {
      courierProductGroupId: this.isEdit ? value.courierProductGroupId : null,
      // Trim leading/trailing spaces — this task's own explicit instruction.
      code: (value.code || '').trim(),
      name: (value.name || '').trim(),
      remarks: value.remarks || null,
    };

    const request$ = this.isEdit ? this.masterApi.edit('master/courierproductgroup', payload) : this.masterApi.add('master/courierproductgroup', payload);
    request$.subscribe({
      next: (res) => {
        this.saving.set(false);
        if (res.success) {
          this.dialogRef.close(true);
        } else {
          // Surfaces the REAL backend message here, e.g. "Duplicate
          // product group code already exists." (this file's own
          // class-level comment).
          this.errorMessage.set(usableMessage(res.message) ?? 'Failed to save this courier product group.');
        }
      },
      error: (err) => {
        this.saving.set(false);
        this.errorMessage.set(extractApiErrorMessage(err) ?? 'Something went wrong while saving this courier product group.');
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
            message: 'Your changes to this courier product group have not been saved.',
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
