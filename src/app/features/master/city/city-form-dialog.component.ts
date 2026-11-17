import { Component, Inject, OnInit, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { DIALOG_DATA } from '../../../shared/ui/dialog/dialog-data.token';
import { DialogRef } from '../../../shared/ui/dialog/dialog-ref';
import { DialogService } from '../../../shared/ui/dialog/dialog.service';
import { ConfirmDialogComponent } from '../shared/confirm-dialog.component';
import { MasterApiService } from '../shared/master-api.service';
import { CityRow, CitySaveRequest } from './city.model';
import { CountryRow } from '../country/country.model';
import { StateRow } from '../state/state.model';
import { extractApiErrorMessage, usableMessage } from '../../../core/utils/api-error.util';
import { handleFormEnterKey } from '../../../core/utils/form-keyboard.util';
import { ButtonComponent } from '../../../shared/ui/button/button.component';
import { InputComponent } from '../../../shared/ui/form/input.component';
import { TextareaComponent } from '../../../shared/ui/form/textarea.component';
import { ComboboxComponent } from '../../../shared/ui/form/combobox.component';
import { SelectOption } from '../../../shared/ui/form/select.component';

export interface CityFormDialogData {
  row: CityRow | null; // null for 'add', present for 'edit'
  mode: 'add' | 'edit';
}

export type CityFormDialogResult = boolean;

// Add/Edit City — not MasterFormDialogComponent-driven. See
// city-list.component.ts's own comment for why. This dialog's whole reason
// for being dedicated is the Country -> State dependency:
//   - Country dropdown: real master/country/get rows filtered to
//     isActive && hasCity (this task's own Section 3).
//   - State dropdown: CONFIRMED LIVE StateGetRequest has no countryId
//     filter param at all (only {stateId, searchText, isActive} — same
//     finding as State Master's own rebuild this session), so "load only
//     active states belonging to the selected Country" is necessarily a
//     client-side filter over the one real master/state/get fetch, not an
//     invented server-side param.
//   - When the selected Country's own real hasState is false, the field's
//     own label becomes "State (Not applicable)" and it's disabled — never
//     a fabricated stateId is sent (see onSubmit()'s own comment).
@Component({
  selector: 'app-city-form-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, ButtonComponent, InputComponent, TextareaComponent, ComboboxComponent],
  templateUrl: './city-form-dialog.component.html',
  styleUrl: './city-form-dialog.component.scss',
})
export class CityFormDialogComponent implements OnInit {
  private readonly masterApi = inject(MasterApiService);
  private readonly dialogService = inject(DialogService);
  protected readonly dialogRef = inject(DialogRef<CityFormDialogResult>);

  protected readonly isEdit: boolean;
  protected readonly saving = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly form: FormGroup;

  protected readonly countriesLoading = signal(true);
  protected readonly countriesError = signal(false);
  protected readonly statesLoading = signal(true);
  protected readonly statesError = signal(false);

  // The row's own saved Country/State are preserved as selectable even if
  // no longer eligible by the time this dialog opens for Edit — "Do not
  // accidentally change Country or State relationships during Edit" (this
  // task's own Section 5), same pattern as State Master's own rebuild.
  private savedCountryOption: CountryRow | null = null;
  private savedStateOption: StateRow | null = null;
  private readonly eligibleCountries = signal<CountryRow[]>([]);
  private readonly allStates = signal<StateRow[]>([]);

  protected readonly countryOptions = computed<SelectOption[]>(() => {
    const options = this.eligibleCountries().map((c) => this.toCountryOption(c));
    if (this.savedCountryOption && !this.eligibleCountries().some((c) => c.countryId === this.savedCountryOption!.countryId)) {
      options.unshift(this.toCountryOption(this.savedCountryOption));
    }
    return options;
  });

  // A plain signal set explicitly, NOT a computed() reading
  // form.get('countryId')!.value directly — see uploadfiles-upload-dialog.
  // component.ts's own comment this session for why a computed() reading a
  // FormControl's plain .value would cache its first result forever.
  protected readonly selectedCountry = signal<CountryRow | null>(null);

  protected readonly stateApplicable = computed(() => !!this.selectedCountry()?.hasState);
  protected readonly stateLabel = computed(() => (this.selectedCountry() && !this.stateApplicable() ? 'State (Not applicable)' : 'State'));
  protected readonly stateOptions = computed<SelectOption[]>(() => {
    const country = this.selectedCountry();
    if (!country) return [];
    const filtered = this.allStates().filter((s) => s.countryId === country.countryId && s.isActive);
    const options = filtered.map((s) => this.toStateOption(s));
    if (this.savedStateOption && this.savedStateOption.countryId === country.countryId && !filtered.some((s) => s.stateId === this.savedStateOption!.stateId)) {
      options.unshift(this.toStateOption(this.savedStateOption));
    }
    return options;
  });

  constructor(@Inject(DIALOG_DATA) public data: CityFormDialogData) {
    this.isEdit = data.mode === 'edit';
    const row = data.row;

    this.form = new FormGroup({
      cityId: new FormControl(row?.cityId ?? null),
      countryId: new FormControl(row?.countryId ?? '', [Validators.required]),
      // Genuinely optional — CityRequest's own real stateId is nullable and
      // required-ness isn't documented anywhere; never invented here (see
      // this file's own class-level comment).
      stateId: new FormControl(row?.stateId ?? ''),
      cityCode: new FormControl(row?.cityCode ?? ''),
      cityName: new FormControl(row?.cityName ?? '', [Validators.required, Validators.maxLength(200)]),
      // Always blank, including on Edit — same confirmed-live
      // write-only-per-action changelog behavior as Country/State/Upload
      // Master's own remarks fields this session (it round-trips through
      // /history/get but is never present on the row itself).
      remarks: new FormControl(''),
    });

    // Starts disabled — "Before a Country is selected: keep the State
    // dropdown disabled" (this task's own Section 3). ComboboxComponent
    // has no [disabled] input of its own (confirmed this session) —
    // disabling it is done the idiomatic Reactive Forms way, through the
    // FormControl itself, which the component's own setDisabledState()
    // (its ControlValueAccessor implementation) reacts to.
    this.form.get('stateId')!.disable({ emitEvent: false });

    // Registered AFTER the initial value above, so restoring the saved
    // countryId on Edit does not immediately clear the saved stateId —
    // only a genuine, later user-driven change should do that.
    this.form.get('countryId')!.valueChanges.subscribe((countryId: string) => {
      this.applySelectedCountry(countryId, true);
    });
  }

  ngOnInit(): void {
    this.loadCountries();
    this.loadStates();
  }

  private toCountryOption(c: CountryRow): SelectOption {
    return { label: c.countryCode ? `${c.countryName} (${c.countryCode})` : (c.countryName ?? ''), value: c.countryId };
  }

  private toStateOption(s: StateRow): SelectOption {
    return { label: s.stateCode ? `${s.stateName} (${s.stateCode})` : (s.stateName ?? ''), value: s.stateId };
  }

  private applySelectedCountry(countryId: string, clearState: boolean): void {
    const country = this.eligibleCountries().find((c) => c.countryId === countryId) ?? (this.savedCountryOption?.countryId === countryId ? this.savedCountryOption : null);
    this.selectedCountry.set(country);

    // Synchronous, not an effect() reacting to stateApplicable() later —
    // a form control's own enabled state should change in lockstep with
    // the action that caused it, not on the next change-detection tick.
    const stateControl = this.form.get('stateId')!;
    if (country?.hasState) {
      if (stateControl.disabled) stateControl.enable({ emitEvent: false });
    } else if (stateControl.enabled) {
      stateControl.disable({ emitEvent: false });
    }

    if (clearState) {
      // Country changed — the previously selected State (if any) may
      // belong to a different Country entirely; clear it rather than
      // silently keeping a now-mismatched relationship.
      stateControl.setValue('', { emitEvent: false });
    }
  }

  private loadCountries(): void {
    this.countriesLoading.set(true);
    this.countriesError.set(false);
    this.masterApi.get<Record<string, unknown>, CountryRow>('master/country', { searchText: null, isActive: null }).subscribe({
      next: (countries) => {
        this.countriesLoading.set(false);
        // Only active countries that support Cities — this task's own
        // Section 3.
        this.eligibleCountries.set(countries.filter((c) => c.isActive && c.hasCity));
        const savedId = this.data.row?.countryId;
        if (savedId) this.savedCountryOption = countries.find((c) => c.countryId === savedId) ?? null;
        // Resolve the initial selection now that country data exists —
        // never clears the already-correct saved stateId.
        const currentCountryId = this.form.get('countryId')!.value;
        if (currentCountryId) this.applySelectedCountry(currentCountryId, false);
      },
      error: () => {
        this.countriesLoading.set(false);
        this.countriesError.set(true);
      },
    });
  }

  private loadStates(): void {
    this.statesLoading.set(true);
    this.statesError.set(false);
    this.masterApi.get<Record<string, unknown>, StateRow>('master/state', { searchText: null, isActive: null }).subscribe({
      next: (states) => {
        this.statesLoading.set(false);
        this.allStates.set(states);
        const savedId = this.data.row?.stateId;
        if (savedId) this.savedStateOption = states.find((s) => s.stateId === savedId) ?? null;
      },
      error: () => {
        this.statesLoading.set(false);
        this.statesError.set(true);
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
    const payload: CitySaveRequest = {
      cityId: this.isEdit ? value.cityId : null,
      countryId: value.countryId,
      // Never a fabricated State ID when the selected Country doesn't
      // support States, regardless of whatever the disabled control's own
      // stale value happens to be — this task's own Section 3.
      stateId: this.stateApplicable() ? value.stateId || null : null,
      cityCode: value.cityCode || null,
      cityName: value.cityName,
      remarks: value.remarks || null,
    };

    const request$ = this.isEdit ? this.masterApi.edit('master/city', payload) : this.masterApi.add('master/city', payload);
    request$.subscribe({
      next: (res) => {
        this.saving.set(false);
        if (res.success) {
          this.dialogRef.close(true);
        } else {
          this.errorMessage.set(usableMessage(res.message) ?? 'Failed to save this city.');
        }
      },
      error: (err) => {
        this.saving.set(false);
        this.errorMessage.set(extractApiErrorMessage(err) ?? 'Something went wrong while saving this city.');
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
            message: 'Your changes to this city have not been saved.',
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
