import { Component, inject, signal } from '@angular/core';
import { AbstractControl, FormControl, FormGroup, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { extractApiErrorMessage, usableMessage } from '../../core/utils/api-error.util';
import { DialogRef } from '../../shared/ui/dialog/dialog-ref';
import { ButtonComponent } from '../../shared/ui/button/button.component';
import { InputComponent } from '../../shared/ui/form/input.component';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { handleFormEnterKey } from '../../core/utils/form-keyboard.util';

// POST admin/user/change-password, OwnPasswordRequest {currentPassword,
// password} — a real, confirmed-live endpoint (UserAccount tag in the
// spec); the server has no "confirm password" field of its own, so that
// third field here is client-side-only, to catch a typo before submitting,
// never sent in the request body.
function passwordsMatchValidator(group: AbstractControl): ValidationErrors | null {
  const password = group.get('newPassword')?.value;
  const confirm = group.get('confirmPassword')?.value;
  return password === confirm ? null : { mismatch: true };
}

@Component({
  selector: 'app-change-password-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, ButtonComponent, InputComponent],
  templateUrl: './change-password-dialog.component.html',
  styleUrl: './change-password-dialog.component.scss',
})
export class ChangePasswordDialogComponent {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);
  protected readonly dialogRef = inject(DialogRef<boolean>);

  protected readonly saving = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly form = new FormGroup(
    {
      currentPassword: new FormControl('', [Validators.required]),
      newPassword: new FormControl('', [Validators.required, Validators.minLength(6)]),
      confirmPassword: new FormControl('', [Validators.required]),
    },
    { validators: passwordsMatchValidator },
  );

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

    const { currentPassword, newPassword } = this.form.getRawValue();
    this.api.post<{ currentPassword: string; password: string }, unknown>('admin/user/change-password', {
      currentPassword: currentPassword!,
      password: newPassword!,
    }).subscribe({
      next: (res) => {
        this.saving.set(false);
        if (res.success) {
          this.toast.show('Password changed successfully.');
          this.dialogRef.close(true);
        } else {
          this.errorMessage.set(usableMessage(res.message) ?? 'Failed to change password.');
        }
      },
      error: (err) => {
        this.saving.set(false);
        this.errorMessage.set(extractApiErrorMessage(err) ?? 'Something went wrong while changing your password.');
      },
    });
  }
}
