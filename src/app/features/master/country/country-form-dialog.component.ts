import { Component, Inject, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { DIALOG_DATA } from '../../../shared/ui/dialog/dialog-data.token';
import { DialogRef } from '../../../shared/ui/dialog/dialog-ref';
import { DialogService } from '../../../shared/ui/dialog/dialog.service';
import { ConfirmDialogComponent } from '../shared/confirm-dialog.component';
import { MasterApiService } from '../shared/master-api.service';
import { CountryRow, CountrySaveRequest } from './country.model';
import { extractApiErrorMessage, usableMessage } from '../../../core/utils/api-error.util';
import { handleFormEnterKey } from '../../../core/utils/form-keyboard.util';
import { ButtonComponent } from '../../../shared/ui/button/button.component';
import { InputComponent } from '../../../shared/ui/form/input.component';
import { CheckboxComponent } from '../../../shared/ui/form/checkbox.component';

export interface CountryFormDialogData {
  row: CountryRow | null; // null for 'add', present for 'edit'
  mode: 'add' | 'edit';
}

export type CountryFormDialogResult = boolean;

// Add/Edit Country — not MasterFormDialogComponent-driven. See
// country-list.component.ts's own comment for why: the real Windows
// reference's own exact layout (Country Code/Country Name sharing one row
// at uneven widths, an "Available Levels" group of 4 independent checkboxes
// positioned inline next to ISD Code rather than in a separate bottom
// checkbox grid, a bordered form panel, a specific subtitle/footer helper
// text/button labels) has no shape in the generic formFields model, and
// isn't worth bolting onto the 23-other-entity-shared MasterFormDialogComponent
// for one entity's own specific visual requirements.
@Component({
  selector: 'app-country-form-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, ButtonComponent, InputComponent, CheckboxComponent],
  templateUrl: './country-form-dialog.component.html',
  styleUrl: './country-form-dialog.component.scss',
})
export class CountryFormDialogComponent {
  private readonly masterApi = inject(MasterApiService);
  private readonly dialogService = inject(DialogService);
  protected readonly dialogRef = inject(DialogRef<CountryFormDialogResult>);

  protected readonly isEdit: boolean;
  protected readonly saving = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly form: FormGroup;

  constructor(@Inject(DIALOG_DATA) public data: CountryFormDialogData) {
    this.isEdit = data.mode === 'edit';
    const row = data.row;

    this.form = new FormGroup({
      countryId: new FormControl(row?.countryId ?? null),
      countryCode: new FormControl(row?.countryCode ?? '', [Validators.required, Validators.maxLength(10)]),
      countryName: new FormControl(row?.countryName ?? '', [Validators.required, Validators.maxLength(200)]),
      isdCode: new FormControl(row?.isdCode ?? ''),
      hasState: new FormControl(row?.hasState ?? false),
      hasCity: new FormControl(row?.hasCity ?? false),
      hasPostalCode: new FormControl(row?.hasPostalCode ?? false),
      hasArea: new FormControl(row?.hasArea ?? false),
      stateLabel: new FormControl(row?.stateLabel ?? ''),
      postalCodeLabel: new FormControl(row?.postalCodeLabel ?? ''),
      // CONFIRMED LIVE: always blank, including on Edit — see
      // country.model.ts's own comment for why (a write-only-per-action
      // changelog note, not persistent row state).
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
    const payload: CountrySaveRequest = {
      countryId: this.isEdit ? value.countryId : null,
      countryCode: value.countryCode,
      countryName: value.countryName,
      isdCode: value.isdCode || null,
      hasState: !!value.hasState,
      hasCity: !!value.hasCity,
      hasPostalCode: !!value.hasPostalCode,
      hasArea: !!value.hasArea,
      stateLabel: value.stateLabel || null,
      postalCodeLabel: value.postalCodeLabel || null,
      remarks: value.remarks || null,
    };

    const request$ = this.isEdit ? this.masterApi.edit('master/country', payload) : this.masterApi.add('master/country', payload);
    request$.subscribe({
      next: (res) => {
        this.saving.set(false);
        if (res.success) {
          this.dialogRef.close(true);
        } else {
          this.errorMessage.set(usableMessage(res.message) ?? 'Failed to save this country.');
        }
      },
      error: (err) => {
        this.saving.set(false);
        this.errorMessage.set(extractApiErrorMessage(err) ?? 'Something went wrong while saving this country.');
      },
    });
  }

  // Cancel should warn about unsaved changes — this dialog's own form
  // starts untouched (Add) or matching the saved row exactly (Edit, aside
  // from Remarks, which always starts blank by design — see this
  // component's own constructor comment), so form.dirty reliably reflects
  // real unsaved work either way.
  protected onCancelClick(): void {
    if (this.form.dirty) {
      this.dialogService
        .open(ConfirmDialogComponent, {
          width: '420px',
          data: {
            title: 'Discard unsaved changes?',
            message: 'Your changes to this country have not been saved.',
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
