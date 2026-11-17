import { Component, Inject, OnInit, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { DIALOG_DATA } from '../../../shared/ui/dialog/dialog-data.token';
import { DialogRef } from '../../../shared/ui/dialog/dialog-ref';
import { DialogService } from '../../../shared/ui/dialog/dialog.service';
import { ConfirmDialogComponent } from '../shared/confirm-dialog.component';
import { MasterApiService } from '../shared/master-api.service';
import { StateRow, StateSaveRequest } from './state.model';
import { CountryRow } from '../country/country.model';
import { extractApiErrorMessage, usableMessage } from '../../../core/utils/api-error.util';
import { handleFormEnterKey } from '../../../core/utils/form-keyboard.util';
import { ButtonComponent } from '../../../shared/ui/button/button.component';
import { InputComponent } from '../../../shared/ui/form/input.component';
import { TextareaComponent } from '../../../shared/ui/form/textarea.component';
import { ComboboxComponent } from '../../../shared/ui/form/combobox.component';
import { SelectOption } from '../../../shared/ui/form/select.component';

export interface StateFormDialogData {
  row: StateRow | null; // null for 'add', present for 'edit'
  mode: 'add' | 'edit';
}

export type StateFormDialogResult = boolean;

// Add/Edit State — not MasterFormDialogComponent-driven. See
// state-list.component.ts's own comment for why. The Country dropdown is
// the entire reason this needed to be dedicated: it must load the real
// Country Master list and filter it to only active, State-enabled
// countries (a country's own real hasState flag — see country.model.ts's
// own comment for the confirmed-live Available Levels fields) with a
// combined "Name (Code)" label, none of which the generic optionsSource
// model (a plain {apiBasePath, valueField, labelField} dropdown with no
// client-side filtering concept) can express.
@Component({
  selector: 'app-state-form-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, ButtonComponent, InputComponent, TextareaComponent, ComboboxComponent],
  templateUrl: './state-form-dialog.component.html',
  styleUrl: './state-form-dialog.component.scss',
})
export class StateFormDialogComponent implements OnInit {
  private readonly masterApi = inject(MasterApiService);
  private readonly dialogService = inject(DialogService);
  protected readonly dialogRef = inject(DialogRef<StateFormDialogResult>);

  protected readonly isEdit: boolean;
  protected readonly saving = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly form: FormGroup;

  protected readonly countriesLoading = signal(true);
  protected readonly countriesError = signal(false);

  // The row's own saved country is preserved as a selectable option even
  // if it's no longer active/State-enabled by the time this dialog opens
  // for Edit — "Do not delete or modify existing State records merely
  // because a Country configuration changes" (this task's own Section 5),
  // same pattern as Upload Master's own savedProcedureOption this session.
  private savedCountryOption: CountryRow | null = null;
  private readonly eligibleCountries = signal<CountryRow[]>([]);
  protected readonly countryOptions = computed<SelectOption[]>(() => {
    const options = this.eligibleCountries().map((c) => this.toOption(c));
    if (this.savedCountryOption && !this.eligibleCountries().some((c) => c.countryId === this.savedCountryOption!.countryId)) {
      options.unshift(this.toOption(this.savedCountryOption));
    }
    return options;
  });

  constructor(@Inject(DIALOG_DATA) public data: StateFormDialogData) {
    this.isEdit = data.mode === 'edit';
    const row = data.row;

    this.form = new FormGroup({
      stateId: new FormControl(row?.stateId ?? null),
      countryId: new FormControl(row?.countryId ?? '', [Validators.required]),
      stateCode: new FormControl(row?.stateCode ?? ''),
      stateName: new FormControl(row?.stateName ?? '', [Validators.required, Validators.maxLength(200)]),
      remarks: new FormControl(''),
    });
  }

  ngOnInit(): void {
    this.loadCountries();
  }

  private toOption(c: CountryRow): SelectOption {
    return { label: c.countryCode ? `${c.countryName} (${c.countryCode})` : (c.countryName ?? ''), value: c.countryId };
  }

  private loadCountries(): void {
    this.countriesLoading.set(true);
    this.countriesError.set(false);
    this.masterApi.get<Record<string, unknown>, CountryRow>('master/country', { searchText: null, isActive: null }).subscribe({
      next: (countries) => {
        this.countriesLoading.set(false);
        // Only active countries that support States — "must not be
        // selectable for a new State record" when hasState is false (this
        // task's own Section 3).
        this.eligibleCountries.set(countries.filter((c) => c.isActive && c.hasState));
        const savedId = this.data.row?.countryId;
        if (savedId) {
          this.savedCountryOption = countries.find((c) => c.countryId === savedId) ?? null;
        }
      },
      error: () => {
        this.countriesLoading.set(false);
        this.countriesError.set(true);
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
    const payload: StateSaveRequest = {
      stateId: this.isEdit ? value.stateId : null,
      countryId: value.countryId,
      stateCode: value.stateCode || null,
      stateName: value.stateName,
      remarks: value.remarks || null,
    };

    const request$ = this.isEdit ? this.masterApi.edit('master/state', payload) : this.masterApi.add('master/state', payload);
    request$.subscribe({
      next: (res) => {
        this.saving.set(false);
        if (res.success) {
          this.dialogRef.close(true);
        } else {
          this.errorMessage.set(usableMessage(res.message) ?? 'Failed to save this state.');
        }
      },
      error: (err) => {
        this.saving.set(false);
        this.errorMessage.set(extractApiErrorMessage(err) ?? 'Something went wrong while saving this state.');
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
            message: 'Your changes to this state have not been saved.',
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
