import { Component, Inject, OnInit, computed, inject, signal } from '@angular/core';
import { AbstractControl, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { DIALOG_DATA } from '../../../shared/ui/dialog/dialog-data.token';
import { DialogRef } from '../../../shared/ui/dialog/dialog-ref';
import { DialogService } from '../../../shared/ui/dialog/dialog.service';
import { ConfirmDialogComponent } from '../shared/confirm-dialog.component';
import { MasterApiService } from '../shared/master-api.service';
import { AreaRow, AreaSaveRequest } from './area.model';
import { CountryRow } from '../country/country.model';
import { StateRow } from '../state/state.model';
import { CityRow } from '../city/city.model';
import { PostalCodeRow } from '../postalcode/postalcode.model';
import { extractApiErrorMessage, usableMessage } from '../../../core/utils/api-error.util';
import { handleFormEnterKey } from '../../../core/utils/form-keyboard.util';
import { ButtonComponent } from '../../../shared/ui/button/button.component';
import { InputComponent } from '../../../shared/ui/form/input.component';
import { TextareaComponent } from '../../../shared/ui/form/textarea.component';
import { ComboboxComponent } from '../../../shared/ui/form/combobox.component';
import { SelectOption } from '../../../shared/ui/form/select.component';

export interface AreaFormDialogData {
  row: AreaRow | null; // null for 'add', present for 'edit'
  mode: 'add' | 'edit';
}

export type AreaFormDialogResult = boolean;

// Add/Edit Area — not MasterFormDialogComponent-driven. See
// area-list.component.ts's own comment for why. This dialog's whole
// reason for being dedicated is the 4-level Country -> State -> City ->
// Postal Code dependency chain, one level deeper than Postal Code
// Master's own 3-level rebuild this session, with each dependent level
// independently gated by its OWN real country capability flag (not
// chained to each other's enabled state) — "Do not assume that a field is
// applicable just because a dropdown exists. Respect the actual Country
// Master configuration and backend behavior" (this task's own explicit
// instruction):
//   - Country dropdown: real master/country/get rows filtered to
//     isActive && hasArea.
//   - State dropdown: disabled + relabeled "State (not applicable)"
//     whenever the selected Country's own real hasState is false — same
//     dynamic relabel pattern as City Master's own rebuild this session
//     (NOT Postal Code Master's static "(optional)" pattern).
//   - City dropdown: disabled + relabeled "City (not applicable)"
//     whenever the selected Country's own real hasCity is false —
//     independently of whatever the State field's own applicability is.
//   - Postal Code dropdown: disabled + relabeled "Postal Code (not
//     applicable)" whenever the selected Country's own real hasPostalCode
//     is false — independently of State/City applicability.
//   - CONFIRMED LIVE none of StateGetRequest/CityGetRequest/
//     PostalcodeGetRequest has a countryId/stateId/cityId filter param
//     (same finding as State/City/Postal Code Master's own rebuilds this
//     session), so State/City/Postal Code options are all client-side
//     filters over one real fetch each, narrowed by whichever parent
//     level(s) are actually selected.
//   - Country change clears State, City AND Postal Code; State change
//     clears City AND Postal Code; City change clears Postal Code only
//     (this task's own "Dependency reset behavior").
//   - Never a fabricated State/City/PostalCode ID sent — onSubmit() reads
//     each control's own real disabled state, not an invented business
//     rule.
@Component({
  selector: 'app-area-form-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, ButtonComponent, InputComponent, TextareaComponent, ComboboxComponent],
  templateUrl: './area-form-dialog.component.html',
  styleUrl: './area-form-dialog.component.scss',
})
export class AreaFormDialogComponent implements OnInit {
  private readonly masterApi = inject(MasterApiService);
  private readonly dialogService = inject(DialogService);
  protected readonly dialogRef = inject(DialogRef<AreaFormDialogResult>);

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
  protected readonly postalCodesLoading = signal(true);
  protected readonly postalCodesError = signal(false);

  // The row's own saved Country/State/City/Postal Code are preserved as
  // selectable even if no longer eligible by the time this dialog opens
  // for Edit — same "preserve existing relationships" pattern as State/
  // City/Postal Code Master's own rebuilds this session.
  private savedCountryOption: CountryRow | null = null;
  private savedStateOption: StateRow | null = null;
  private savedCityOption: CityRow | null = null;
  private savedPostalCodeOption: PostalCodeRow | null = null;
  private readonly eligibleCountries = signal<CountryRow[]>([]);
  private readonly allStates = signal<StateRow[]>([]);
  private readonly allCities = signal<CityRow[]>([]);
  private readonly allPostalCodes = signal<PostalCodeRow[]>([]);

  protected readonly countryOptions = computed<SelectOption[]>(() => {
    const options = this.eligibleCountries().map((c) => this.toCountryOption(c));
    if (this.savedCountryOption && !this.eligibleCountries().some((c) => c.countryId === this.savedCountryOption!.countryId)) {
      options.unshift(this.toCountryOption(this.savedCountryOption));
    }
    return options;
  });

  // Plain signals set explicitly from valueChanges/initial-load callbacks,
  // NOT computed() reading FormControl.value directly — see
  // uploadfiles-upload-dialog.component.ts's own comment this session for
  // why that would cache its first read forever.
  protected readonly selectedCountry = signal<CountryRow | null>(null);
  protected readonly selectedStateId = signal<string>('');
  protected readonly selectedCityId = signal<string>('');

  // Each dependent level is gated by its OWN real country capability
  // flag — never chained to another dependent level's own applicability
  // (e.g. Afghanistan in the real data has hasState=false but
  // hasCity=true, confirming these are genuinely independent).
  protected readonly stateApplicable = computed(() => !!this.selectedCountry()?.hasState);
  protected readonly stateLabel = computed(() => (this.selectedCountry() && !this.stateApplicable() ? 'State (not applicable)' : 'State'));
  protected readonly cityApplicable = computed(() => !!this.selectedCountry()?.hasCity);
  protected readonly cityLabel = computed(() => (this.selectedCountry() && !this.cityApplicable() ? 'City (not applicable)' : 'City'));
  protected readonly postalCodeApplicable = computed(() => !!this.selectedCountry()?.hasPostalCode);
  protected readonly postalCodeLabel = computed(() => (this.selectedCountry() && !this.postalCodeApplicable() ? 'Postal Code (not applicable)' : 'Postal Code'));

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

  protected readonly cityOptions = computed<SelectOption[]>(() => {
    const country = this.selectedCountry();
    if (!country) return [];
    const stateId = this.selectedStateId();
    let filtered = this.allCities().filter((c) => c.countryId === country.countryId && c.isActive);
    if (stateId) filtered = filtered.filter((c) => c.stateId === stateId);
    const options = filtered.map((c) => this.toCityOption(c));
    if (this.savedCityOption && this.savedCityOption.countryId === country.countryId && (!stateId || this.savedCityOption.stateId === stateId) && !filtered.some((c) => c.cityId === this.savedCityOption!.cityId)) {
      options.unshift(this.toCityOption(this.savedCityOption));
    }
    return options;
  });

  protected readonly postalCodeOptions = computed<SelectOption[]>(() => {
    const country = this.selectedCountry();
    if (!country) return [];
    const stateId = this.selectedStateId();
    const cityId = this.selectedCityId();
    let filtered = this.allPostalCodes().filter((p) => p.countryId === country.countryId && p.isActive);
    if (cityId) {
      filtered = filtered.filter((p) => p.cityId === cityId);
    } else if (stateId) {
      filtered = filtered.filter((p) => p.stateId === stateId);
    }
    const options = filtered.map((p) => this.toPostalCodeOption(p));
    const saved = this.savedPostalCodeOption;
    if (saved && saved.countryId === country.countryId && (!cityId || saved.cityId === cityId) && (!stateId || saved.stateId === stateId) && !filtered.some((p) => p.postalCodeId === saved.postalCodeId)) {
      options.unshift(this.toPostalCodeOption(saved));
    }
    return options;
  });

  constructor(@Inject(DIALOG_DATA) public data: AreaFormDialogData) {
    this.isEdit = data.mode === 'edit';
    const row = data.row;

    this.form = new FormGroup({
      areaId: new FormControl(row?.areaId ?? null),
      countryId: new FormControl(row?.countryId ?? '', [Validators.required]),
      // State/City/Postal Code genuinely optional — the real AreaRequest's
      // own stateId/cityId/postalCodeId are all nullable and required-ness
      // isn't documented anywhere; never invented here (see this file's
      // own class-level comment).
      stateId: new FormControl(row?.stateId ?? ''),
      cityId: new FormControl(row?.cityId ?? ''),
      postalCodeId: new FormControl(row?.postalCodeId ?? ''),
      areaCode: new FormControl(row?.areaCode ?? ''),
      areaName: new FormControl(row?.areaName ?? '', [Validators.required, Validators.maxLength(200)]),
      // Always blank, including on Edit — same confirmed-live
      // write-only-per-action changelog behavior as Country/State/City/
      // Postal Code/Upload Master's own remarks fields this session.
      remarks: new FormControl(''),
    });

    // All three dependent levels start disabled — "Before a Country is
    // selected, State/City/Postal Code dropdowns must remain disabled"
    // (same pattern as City/Postal Code Master's own rebuilds).
    this.form.get('stateId')!.disable({ emitEvent: false });
    this.form.get('cityId')!.disable({ emitEvent: false });
    this.form.get('postalCodeId')!.disable({ emitEvent: false });

    // Registered AFTER the initial values above, so restoring a saved
    // row's own countryId/stateId/cityId on Edit does not immediately
    // clear its own already-correct dependents — only a genuine, later
    // user-driven change should do that.
    this.form.get('countryId')!.valueChanges.subscribe((countryId: string) => {
      this.applySelectedCountry(countryId, true);
    });
    this.form.get('stateId')!.valueChanges.subscribe((stateId: string) => {
      this.applySelectedState(stateId, true);
    });
    this.form.get('cityId')!.valueChanges.subscribe((cityId: string) => {
      this.applySelectedCity(cityId, true);
    });
  }

  ngOnInit(): void {
    this.loadCountries();
    this.loadStates();
    this.loadCities();
    this.loadPostalCodes();
  }

  private toCountryOption(c: CountryRow): SelectOption {
    return { label: c.countryCode ? `${c.countryName} (${c.countryCode})` : (c.countryName ?? ''), value: c.countryId };
  }

  private toStateOption(s: StateRow): SelectOption {
    return { label: s.stateCode ? `${s.stateName} (${s.stateCode})` : (s.stateName ?? ''), value: s.stateId };
  }

  private toCityOption(c: CityRow): SelectOption {
    return { label: c.cityCode ? `${c.cityName} (${c.cityCode})` : (c.cityName ?? ''), value: c.cityId };
  }

  private toPostalCodeOption(p: PostalCodeRow): SelectOption {
    return { label: p.postalCode ?? '', value: p.postalCodeId };
  }

  private applySelectedCountry(countryId: string, resetDependents: boolean): void {
    const country = this.eligibleCountries().find((c) => c.countryId === countryId) ?? (this.savedCountryOption?.countryId === countryId ? this.savedCountryOption : null);
    this.selectedCountry.set(country);

    // Synchronous, not an effect() reacting to a computed signal later — a
    // form control's own enabled state should change in lockstep with the
    // action that caused it (see city-form-dialog.component.ts's own
    // comment this session for the async-effect() timing bug this avoids).
    // Each control is gated by its OWN capability flag independently.
    this.syncControlEnabled(this.form.get('stateId')!, !!country?.hasState);
    this.syncControlEnabled(this.form.get('cityId')!, !!country?.hasCity);
    this.syncControlEnabled(this.form.get('postalCodeId')!, !!country?.hasPostalCode);

    if (resetDependents) {
      // Country changed — clear State, City AND Postal Code (this task's
      // own "Dependency reset behavior").
      this.form.get('stateId')!.setValue('', { emitEvent: false });
      this.selectedStateId.set('');
      this.form.get('cityId')!.setValue('', { emitEvent: false });
      this.selectedCityId.set('');
      this.form.get('postalCodeId')!.setValue('', { emitEvent: false });
    }
  }

  private applySelectedState(stateId: string, resetDependents: boolean): void {
    this.selectedStateId.set(stateId);
    if (resetDependents) {
      // State changed — clear City AND Postal Code (this task's own
      // "Dependency reset behavior").
      this.form.get('cityId')!.setValue('', { emitEvent: false });
      this.selectedCityId.set('');
      this.form.get('postalCodeId')!.setValue('', { emitEvent: false });
    }
  }

  private applySelectedCity(cityId: string, resetPostalCode: boolean): void {
    this.selectedCityId.set(cityId);
    if (resetPostalCode) {
      // City changed — clear Postal Code only (this task's own
      // "Dependency reset behavior").
      this.form.get('postalCodeId')!.setValue('', { emitEvent: false });
    }
  }

  private syncControlEnabled(control: AbstractControl, shouldBeEnabled: boolean): void {
    if (shouldBeEnabled) {
      if (control.disabled) control.enable({ emitEvent: false });
    } else if (control.enabled) {
      control.disable({ emitEvent: false });
    }
  }

  private loadCountries(): void {
    this.countriesLoading.set(true);
    this.countriesError.set(false);
    this.masterApi.get<Record<string, unknown>, CountryRow>('master/country', { searchText: null, isActive: null }).subscribe({
      next: (countries) => {
        this.countriesLoading.set(false);
        // Only active countries that support Areas.
        this.eligibleCountries.set(countries.filter((c) => c.isActive && c.hasArea));
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
        const currentCityId = this.form.get('cityId')!.value;
        if (currentCityId) this.applySelectedCity(currentCityId, false);
      },
      error: () => {
        this.citiesLoading.set(false);
        this.citiesError.set(true);
      },
    });
  }

  private loadPostalCodes(): void {
    this.postalCodesLoading.set(true);
    this.postalCodesError.set(false);
    this.masterApi.get<Record<string, unknown>, PostalCodeRow>('master/postalcode', { searchText: null, isActive: null }).subscribe({
      next: (postalCodes) => {
        this.postalCodesLoading.set(false);
        this.allPostalCodes.set(postalCodes);
        const savedId = this.data.row?.postalCodeId;
        if (savedId) this.savedPostalCodeOption = postalCodes.find((p) => p.postalCodeId === savedId) ?? null;
      },
      error: () => {
        this.postalCodesLoading.set(false);
        this.postalCodesError.set(true);
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
    const payload: AreaSaveRequest = {
      areaId: this.isEdit ? value.areaId : null,
      countryId: value.countryId,
      // Never a fabricated State/City/Postal Code ID — read directly from
      // each control's own real disabled state, not a re-derived business
      // rule.
      stateId: this.form.get('stateId')!.disabled ? null : value.stateId || null,
      cityId: this.form.get('cityId')!.disabled ? null : value.cityId || null,
      postalCodeId: this.form.get('postalCodeId')!.disabled ? null : value.postalCodeId || null,
      areaCode: value.areaCode || null,
      areaName: value.areaName,
      remarks: value.remarks || null,
    };

    const request$ = this.isEdit ? this.masterApi.edit('master/area', payload) : this.masterApi.add('master/area', payload);
    request$.subscribe({
      next: (res) => {
        this.saving.set(false);
        if (res.success) {
          this.dialogRef.close(true);
        } else {
          this.errorMessage.set(usableMessage(res.message) ?? 'Failed to save this area.');
        }
      },
      error: (err) => {
        this.saving.set(false);
        this.errorMessage.set(extractApiErrorMessage(err) ?? 'Something went wrong while saving this area.');
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
            message: 'Your changes to this area have not been saved.',
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
