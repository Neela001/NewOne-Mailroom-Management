import { Component, Inject, OnInit, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { DIALOG_DATA } from '../../../shared/ui/dialog/dialog-data.token';
import { DialogRef } from '../../../shared/ui/dialog/dialog-ref';
import { DialogService } from '../../../shared/ui/dialog/dialog.service';
import { ConfirmDialogComponent } from '../shared/confirm-dialog.component';
import { MasterApiService } from '../shared/master-api.service';
import { PostalCodeRow, PostalCodeSaveRequest } from './postalcode.model';
import { CountryRow } from '../country/country.model';
import { StateRow } from '../state/state.model';
import { CityRow } from '../city/city.model';
import { extractApiErrorMessage, usableMessage } from '../../../core/utils/api-error.util';
import { handleFormEnterKey } from '../../../core/utils/form-keyboard.util';
import { ButtonComponent } from '../../../shared/ui/button/button.component';
import { InputComponent } from '../../../shared/ui/form/input.component';
import { TextareaComponent } from '../../../shared/ui/form/textarea.component';
import { ComboboxComponent } from '../../../shared/ui/form/combobox.component';
import { SelectOption } from '../../../shared/ui/form/select.component';

export interface PostalCodeFormDialogData {
  row: PostalCodeRow | null; // null for 'add', present for 'edit'
  mode: 'add' | 'edit';
}

export type PostalCodeFormDialogResult = boolean;

// Add/Edit Postal Code — not MasterFormDialogComponent-driven. See
// postalcode-list.component.ts's own comment for why. This dialog's whole
// reason for being dedicated is the 3-level Country -> State -> City
// dependency, one level deeper than City Master's own Country -> State
// rebuild this session:
//   - Country dropdown: real master/country/get rows filtered to
//     isActive && hasPostalCode (this task's own Section 3).
//   - State dropdown (optional): CONFIRMED LIVE StateGetRequest has no
//     countryId filter param (same finding as State/City Master's own
//     rebuilds this session), so it's a client-side filter over one real
//     master/state/get fetch. Disabled whenever no Country is selected, or
//     the selected Country's own real hasState is false — never required.
//   - City dropdown (optional): CONFIRMED LIVE CityGetRequest also has no
//     countryId/stateId filter param, so it's likewise a client-side
//     filter — by the selected Country alone, further narrowed to the
//     selected State's own real cities (CityRow's own stateId) whenever
//     one is chosen. Enabled whenever a Country is selected (not gated on
//     hasState, since City doesn't depend on State support at all).
//   - Country change clears State AND City; State change clears City only
//     (this task's own "Dependency reset behavior").
//   - Never a fabricated stateId/cityId sent — onSubmit() reads each
//     control's own real disabled state, not an invented business rule.
@Component({
  selector: 'app-postalcode-form-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, ButtonComponent, InputComponent, TextareaComponent, ComboboxComponent],
  templateUrl: './postalcode-form-dialog.component.html',
  styleUrl: './postalcode-form-dialog.component.scss',
})
export class PostalCodeFormDialogComponent implements OnInit {
  private readonly masterApi = inject(MasterApiService);
  private readonly dialogService = inject(DialogService);
  protected readonly dialogRef = inject(DialogRef<PostalCodeFormDialogResult>);

  protected readonly isEdit: boolean;
  protected readonly saving = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly form: FormGroup;

  protected readonly countriesLoading = signal(true);
  protected readonly countriesError = signal(false);
  protected readonly statesLoading = signal(true);
  protected readonly statesError = signal(false);
  protected readonly citiesLoading = signal(true);
  protected readonly citiesError = signal(false);

  // The row's own saved Country/State/City are preserved as selectable
  // even if no longer eligible by the time this dialog opens for Edit —
  // "Preserve all existing relationships unless explicitly changed by the
  // user" (this task's own Section 6), same pattern as State/City
  // Master's own rebuilds.
  private savedCountryOption: CountryRow | null = null;
  private savedStateOption: StateRow | null = null;
  private savedCityOption: CityRow | null = null;
  private readonly eligibleCountries = signal<CountryRow[]>([]);
  private readonly allStates = signal<StateRow[]>([]);
  private readonly allCities = signal<CityRow[]>([]);

  protected readonly countryOptions = computed<SelectOption[]>(() => {
    const options = this.eligibleCountries().map((c) => this.toOption(c.countryName, c.countryCode, c.countryId));
    if (this.savedCountryOption && !this.eligibleCountries().some((c) => c.countryId === this.savedCountryOption!.countryId)) {
      options.unshift(this.toOption(this.savedCountryOption.countryName, this.savedCountryOption.countryCode, this.savedCountryOption.countryId));
    }
    return options;
  });

  // Plain signals set explicitly from valueChanges/initial-load callbacks,
  // NOT computed() reading FormControl.value directly — see
  // uploadfiles-upload-dialog.component.ts's own comment this session for
  // why that would cache its first read forever.
  protected readonly selectedCountry = signal<CountryRow | null>(null);
  protected readonly selectedStateId = signal<string>('');

  protected readonly stateOptions = computed<SelectOption[]>(() => {
    const country = this.selectedCountry();
    if (!country) return [];
    const filtered = this.allStates().filter((s) => s.countryId === country.countryId && s.isActive);
    const options = filtered.map((s) => this.toOption(s.stateName, s.stateCode, s.stateId));
    if (this.savedStateOption && this.savedStateOption.countryId === country.countryId && !filtered.some((s) => s.stateId === this.savedStateOption!.stateId)) {
      options.unshift(this.toOption(this.savedStateOption.stateName, this.savedStateOption.stateCode, this.savedStateOption.stateId));
    }
    return options;
  });

  protected readonly cityOptions = computed<SelectOption[]>(() => {
    const country = this.selectedCountry();
    if (!country) return [];
    const stateId = this.selectedStateId();
    let filtered = this.allCities().filter((c) => c.countryId === country.countryId && c.isActive);
    if (stateId) filtered = filtered.filter((c) => c.stateId === stateId);
    const options = filtered.map((c) => this.toOption(c.cityName, c.cityCode, c.cityId));
    if (this.savedCityOption && this.savedCityOption.countryId === country.countryId && (!stateId || this.savedCityOption.stateId === stateId) && !filtered.some((c) => c.cityId === this.savedCityOption!.cityId)) {
      options.unshift(this.toOption(this.savedCityOption.cityName, this.savedCityOption.cityCode, this.savedCityOption.cityId));
    }
    return options;
  });

  constructor(@Inject(DIALOG_DATA) public data: PostalCodeFormDialogData) {
    this.isEdit = data.mode === 'edit';
    const row = data.row;

    this.form = new FormGroup({
      postalCodeId: new FormControl(row?.postalCodeId ?? null),
      countryId: new FormControl(row?.countryId ?? '', [Validators.required]),
      // Both genuinely optional — the real PostalcodeRequest's own
      // stateId/cityId are nullable and required-ness isn't documented
      // anywhere; never invented here (see this file's own class-level
      // comment).
      stateId: new FormControl(row?.stateId ?? ''),
      cityId: new FormControl(row?.cityId ?? ''),
      // Plain text, never number — see postalcode.model.ts's own comment
      // for why (preserves a leading-zero postal code exactly as typed).
      postalCode: new FormControl(row?.postalCode ?? '', [Validators.required, Validators.maxLength(20)]),
      // Always blank, including on Edit — same confirmed-live
      // write-only-per-action changelog behavior as Country/State/City/
      // Upload Master's own remarks fields this session.
      remarks: new FormControl(''),
    });

    // Both start disabled — "Before a Country is selected: State and City
    // dropdowns must remain disabled" (this task's own Section 3).
    this.form.get('stateId')!.disable({ emitEvent: false });
    this.form.get('cityId')!.disable({ emitEvent: false });

    // Registered AFTER the initial values above, so restoring a saved
    // row's own countryId/stateId on Edit does not immediately clear its
    // own already-correct stateId/cityId — only a genuine, later
    // user-driven change should do that.
    this.form.get('countryId')!.valueChanges.subscribe((countryId: string) => {
      this.applySelectedCountry(countryId, true);
    });
    this.form.get('stateId')!.valueChanges.subscribe((stateId: string) => {
      this.applySelectedState(stateId, true);
    });
  }

  ngOnInit(): void {
    this.loadCountries();
    this.loadStates();
    this.loadCities();
  }

  private toOption(name: string | null | undefined, code: string | null | undefined, id: string): SelectOption {
    return { label: code ? `${name} (${code})` : (name ?? ''), value: id };
  }

  private applySelectedCountry(countryId: string, resetDependents: boolean): void {
    const country = this.eligibleCountries().find((c) => c.countryId === countryId) ?? (this.savedCountryOption?.countryId === countryId ? this.savedCountryOption : null);
    this.selectedCountry.set(country);

    // Synchronous, not an effect() reacting to a computed signal later — a
    // form control's own enabled state should change in lockstep with the
    // action that caused it (see city-form-dialog.component.ts's own
    // comment this session for the async-effect() timing bug this avoids).
    const stateControl = this.form.get('stateId')!;
    if (country?.hasState) {
      if (stateControl.disabled) stateControl.enable({ emitEvent: false });
    } else if (stateControl.enabled) {
      stateControl.disable({ emitEvent: false });
    }

    const cityControl = this.form.get('cityId')!;
    if (country) {
      if (cityControl.disabled) cityControl.enable({ emitEvent: false });
    } else if (cityControl.enabled) {
      cityControl.disable({ emitEvent: false });
    }

    if (resetDependents) {
      // Country changed — clear both State and City (this task's own
      // "Dependency reset behavior").
      stateControl.setValue('', { emitEvent: false });
      this.selectedStateId.set('');
      cityControl.setValue('', { emitEvent: false });
    }
  }

  private applySelectedState(stateId: string, resetCity: boolean): void {
    this.selectedStateId.set(stateId);
    if (resetCity) {
      // State changed — clear City only, not Country (this task's own
      // "Dependency reset behavior").
      this.form.get('cityId')!.setValue('', { emitEvent: false });
    }
  }

  private loadCountries(): void {
    this.countriesLoading.set(true);
    this.countriesError.set(false);
    this.masterApi.get<Record<string, unknown>, CountryRow>('master/country', { searchText: null, isActive: null }).subscribe({
      next: (countries) => {
        this.countriesLoading.set(false);
        // Only active countries configured to support Postal Code — this
        // task's own Section 3.
        this.eligibleCountries.set(countries.filter((c) => c.isActive && c.hasPostalCode));
        const savedId = this.data.row?.countryId;
        if (savedId) this.savedCountryOption = countries.find((c) => c.countryId === savedId) ?? null;
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
        const currentStateId = this.form.get('stateId')!.value;
        if (currentStateId) this.applySelectedState(currentStateId, false);
      },
      error: () => {
        this.statesLoading.set(false);
        this.statesError.set(true);
      },
    });
  }

  private loadCities(): void {
    this.citiesLoading.set(true);
    this.citiesError.set(false);
    this.masterApi.get<Record<string, unknown>, CityRow>('master/city', { searchText: null, isActive: null }).subscribe({
      next: (cities) => {
        this.citiesLoading.set(false);
        this.allCities.set(cities);
        const savedId = this.data.row?.cityId;
        if (savedId) this.savedCityOption = cities.find((c) => c.cityId === savedId) ?? null;
      },
      error: () => {
        this.citiesLoading.set(false);
        this.citiesError.set(true);
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
    const payload: PostalCodeSaveRequest = {
      postalCodeId: this.isEdit ? value.postalCodeId : null,
      countryId: value.countryId,
      // Never a fabricated State/City ID — read directly from each
      // control's own real disabled state, not a re-derived business rule.
      stateId: this.form.get('stateId')!.disabled ? null : value.stateId || null,
      cityId: this.form.get('cityId')!.disabled ? null : value.cityId || null,
      postalCode: value.postalCode,
      remarks: value.remarks || null,
    };

    const request$ = this.isEdit ? this.masterApi.edit('master/postalcode', payload) : this.masterApi.add('master/postalcode', payload);
    request$.subscribe({
      next: (res) => {
        this.saving.set(false);
        if (res.success) {
          this.dialogRef.close(true);
        } else {
          this.errorMessage.set(usableMessage(res.message) ?? 'Failed to save this postal code.');
        }
      },
      error: (err) => {
        this.saving.set(false);
        this.errorMessage.set(extractApiErrorMessage(err) ?? 'Something went wrong while saving this postal code.');
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
            message: 'Your changes to this postal code have not been saved.',
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
