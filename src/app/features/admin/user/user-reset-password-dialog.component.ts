import { Component, Inject, inject, signal } from '@angular/core';
import { AbstractControl, FormControl, FormGroup, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { DIALOG_DATA } from '../../../shared/ui/dialog/dialog-data.token';
import { DialogRef } from '../../../shared/ui/dialog/dialog-ref';
import { ApiService } from '../../../core/services/api.service';
import { extractApiErrorMessage, usableMessage } from '../../../core/utils/api-error.util';
import { handleFormEnterKey } from '../../../core/utils/form-keyboard.util';
import { ButtonComponent } from '../../../shared/ui/button/button.component';
import { InputComponent } from '../../../shared/ui/form/input.component';

export interface UserResetPasswordDialogData {
  userId: string;
  userName: string;
}

function passwordsMatchValidator(group: AbstractControl): ValidationErrors | null {
  const password = group.get('password')?.value;
  const confirm = group.get('confirmPassword')?.value;
  return password === confirm ? null : { mismatch: true };
}

// POST admin/user/reset-password, UserAccountRequest {userId, password} —
// CONFIRMED real, distinct from admin/user/change-password's own
// OwnPasswordRequest {currentPassword, password} (the self-service "Change
// My Password" flow already used elsewhere in this app). This is the
// admin-on-behalf-of-another-user action from User Master's own toolbar —
// the admin supplies the new password directly (the real request schema
// has no "auto-generate" option), never logged or echoed back.
@Component({
  selector: 'app-user-reset-password-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, ButtonComponent, InputComponent],
  templateUrl: './user-reset-password-dialog.component.html',
  styleUrl: './user-reset-password-dialog.component.scss',
})
export class UserResetPasswordDialogComponent {
  private readonly api = inject(ApiService);
  protected readonly dialogRef = inject(DialogRef<boolean>);

  protected readonly saving = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  // 8 characters — same reference-screenshot-sourced minimum as Add/Edit
  // User's own password field (not documented by the live Swagger spec).
  protected readonly form = new FormGroup(
    {
      password: new FormControl('', [Validators.required, Validators.minLength(8)]),
      confirmPassword: new FormControl('', [Validators.required]),
    },
    { validators: passwordsMatchValidator },
  );

  constructor(@Inject(DIALOG_DATA) public data: UserResetPasswordDialogData) {}

  close(): void {
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

    this.api.post<{ userId: string; password: string }, unknown>('admin/user/reset-password', { userId: this.data.userId, password: this.form.getRawValue().password! }).subscribe({
      next: (res) => {
        this.saving.set(false);
        if (res.success) {
          this.dialogRef.close(true);
        } else {
          this.errorMessage.set(usableMessage(res.message) ?? 'Failed to reset this password.');
        }
      },
      error: (err) => {
        this.saving.set(false);
        this.errorMessage.set(extractApiErrorMessage(err) ?? 'Something went wrong while resetting this password.');
      },
    });
  }
}
