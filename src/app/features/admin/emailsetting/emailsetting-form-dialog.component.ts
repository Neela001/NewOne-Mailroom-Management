import { Component, Inject, OnInit, computed, effect, inject, signal } from '@angular/core';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { DIALOG_DATA } from '../../../shared/ui/dialog/dialog-data.token';
import { DialogRef } from '../../../shared/ui/dialog/dialog-ref';
import { ApiService } from '../../../core/services/api.service';
import { extractApiErrorMessage, usableMessage } from '../../../core/utils/api-error.util';
import { handleFormEnterKey } from '../../../core/utils/form-keyboard.util';
import { ButtonComponent } from '../../../shared/ui/button/button.component';
import { InputComponent } from '../../../shared/ui/form/input.component';
import { SelectComponent, SelectOption } from '../../../shared/ui/form/select.component';
import { CheckboxComponent } from '../../../shared/ui/form/checkbox.component';
import { TextareaComponent } from '../../../shared/ui/form/textarea.component';
import { EmailSettingRow, SmtpOptionsResponse } from './emailsetting.model';

export interface EmailSettingFormDialogData {
  row: EmailSettingRow | null; // null for 'add'
  mode: 'add' | 'edit';
}

export type EmailSettingFormDialogResult = boolean;

const NOT_SPECIFIED: SelectOption = { label: '(Not specified)', value: '' };

// Dedicated — not MasterFormDialogComponent-driven — see
// emailsetting-list.component.ts's own comment for why: Authentication/
// Encryption are real server-driven option sets (master/email-setting/
// options/get, not a static list), there's a "Remove saved password"
// checkbox feeding a real clearPassword flag, a Reload SMTP options action,
// and save-state-dependent hint text the generic form-field model has no
// shape for.
@Component({
  selector: 'app-emailsetting-form-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, FormsModule, ButtonComponent, InputComponent, SelectComponent, CheckboxComponent, TextareaComponent],
  templateUrl: './emailsetting-form-dialog.component.html',
  styleUrl: './emailsetting-form-dialog.component.scss',
})
export class EmailSettingFormDialogComponent implements OnInit {
  private readonly api = inject(ApiService);
  protected readonly dialogRef = inject(DialogRef<EmailSettingFormDialogResult>);

  protected readonly isEdit: boolean;
  protected readonly dialogTitle: string;
  protected readonly saving = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly loadingOptions = signal(false);
  protected readonly optionsError = signal(false);
  protected readonly smtpOptions = signal<SmtpOptionsResponse | null>(null);
  protected readonly authOptions = computed<SelectOption[]>(() => [NOT_SPECIFIED, ...(this.smtpOptions()?.authentication ?? []).map((o) => ({ label: o.name, value: o.value }))]);
  protected readonly encryptionOptions = computed<SelectOption[]>(() => [NOT_SPECIFIED, ...(this.smtpOptions()?.encryptionMethods ?? []).map((o) => ({ label: o.name, value: o.value }))]);

  // The already-had-a-password state never changes within this dialog's own
  // lifetime (the checkbox below is how the user ACTS on it, not a second
  // source of truth for whether one currently exists). Set in the
  // constructor body, not as a field initializer — field initializers run
  // before the constructor's own parameter-property assignment, so
  // `this.data` isn't set yet at that point.
  protected readonly hadPassword: boolean;
  protected readonly removePassword = signal(false);

  protected readonly form: FormGroup;

  protected readonly authEncryptionSummary = computed(() => {
    const authVal = this.form?.get('authFlag')?.value;
    const encVal = this.form?.get('encrptMethod')?.value;
    const authName = this.authOptions().find((o) => String(o.value) === String(authVal))?.label;
    const encName = this.encryptionOptions().find((o) => String(o.value) === String(encVal))?.label;
    if (!authName && !encName) return null;
    return [authName || '(Not specified)', encName || '(Not specified)'].join(' · ');
  });

  constructor(@Inject(DIALOG_DATA) public data: EmailSettingFormDialogData) {
    this.isEdit = data.mode === 'edit';
    this.dialogTitle = this.isEdit ? 'Edit Email Setting' : 'Add Email Setting';
    this.hadPassword = data.row?.hasPassword ?? false;

    const row = data.row;
    this.form = new FormGroup({
      emailName: new FormControl(row?.emailName ?? '', [Validators.required]),
      emailAddress: new FormControl(row?.emailAddress ?? '', [Validators.required, Validators.email]),
      smtpServer: new FormControl(row?.smtpServer ?? ''),
      port: new FormControl(row?.port ?? ''),
      authFlag: new FormControl(row?.authFlag ?? ''),
      encrptMethod: new FormControl(row?.encrptMethod ?? ''),
      userName: new FormControl(row?.userName ?? ''),
      password: new FormControl(''), // never pre-filled with the stored password — see onSubmit()'s own comment
      targetName: new FormControl(row?.targetName ?? ''),
      remarks: new FormControl(''),
    });

    // Reactive FormGroup, so disabling the control actually invokes
    // InputComponent's own setDisabledState() via Angular's forms
    // machinery — a plain [disabled] binding on a custom
    // ControlValueAccessor like app-input has no public @Input to bind to.
    effect(() => {
      const control = this.form.get('password');
      if (!control) return;
      if (this.removePassword()) control.disable({ emitEvent: false });
      else control.enable({ emitEvent: false });
    });
  }

  ngOnInit(): void {
    this.loadOptions();
  }

  private loadOptions(): void {
    this.loadingOptions.set(true);
    this.optionsError.set(false);
    this.api.post<Record<string, never>, SmtpOptionsResponse>('master/email-setting/options/get', {}).subscribe({
      next: (res) => {
        this.loadingOptions.set(false);
        if (res.success && res.data) {
          this.smtpOptions.set(res.data);
        } else {
          this.optionsError.set(true);
        }
      },
      error: () => {
        this.loadingOptions.set(false);
        this.optionsError.set(true);
      },
    });
  }

  reloadOptions(): void {
    this.loadOptions();
  }

  protected get passwordHint(): string {
    if (this.removePassword()) return 'Password will be removed when you save.';
    return this.hadPassword ? 'Saved password exists. Leave blank to retain the existing password.' : 'No saved password. Password is optional.';
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

    const raw = this.form.getRawValue();
    const payload = {
      emailSettingId: this.isEdit ? this.data.row!.emailSettingId : undefined,
      emailName: raw.emailName,
      emailAddress: raw.emailAddress,
      smtpServer: raw.smtpServer || null,
      port: raw.port || null,
      authFlag: raw.authFlag === '' || raw.authFlag === null ? null : Number(raw.authFlag),
      encrptMethod: raw.encrptMethod === '' || raw.encrptMethod === null ? null : Number(raw.encrptMethod),
      userName: raw.userName || null,
      // Blank password on Edit means "leave the existing one alone" — never
      // send an empty string as if it were a real new password; only a
      // genuinely typed value, or the explicit Remove-saved-password
      // checkbox, changes what's stored. Never logged — see this
      // component's own class-level comment.
      password: raw.password || null,
      clearPassword: this.removePassword(),
      targetName: raw.targetName || null,
      remarks: raw.remarks || null,
    };

    const path = this.isEdit ? 'master/email-setting/edit' : 'master/email-setting/add';
    this.api.post<typeof payload, unknown>(path, payload).subscribe({
      next: (res) => {
        this.saving.set(false);
        if (res.success) {
          this.dialogRef.close(true);
        } else {
          this.errorMessage.set(usableMessage(res.message) ?? 'Failed to save this email setting.');
        }
      },
      error: (err) => {
        this.saving.set(false);
        this.errorMessage.set(extractApiErrorMessage(err) ?? 'Something went wrong while saving this email setting.');
      },
    });
  }
}
