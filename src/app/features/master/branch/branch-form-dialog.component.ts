import { Component, Inject, OnInit, computed, inject, signal } from '@angular/core';
import { AbstractControl, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { DIALOG_DATA } from '../../../shared/ui/dialog/dialog-data.token';
import { DialogRef } from '../../../shared/ui/dialog/dialog-ref';
import { DialogService } from '../../../shared/ui/dialog/dialog.service';
import { ConfirmDialogComponent } from '../shared/confirm-dialog.component';
import { MasterApiService } from '../shared/master-api.service';
import { ApiService } from '../../../core/services/api.service';
import { normalizeRowKeys } from '../shared/pascal-case.util';
import { BranchLocationItem, BranchLocationOptionRow, BranchRow, BranchSaveRequest } from './branch.model';
import { CompanyRow } from '../company/company.model';
import { CountryRow } from '../country/country.model';
import { CityRow } from '../city/city.model';
import { SiteRow } from '../site/site.model';
import { extractApiErrorMessage, usableMessage } from '../../../core/utils/api-error.util';
import { handleFormEnterKey } from '../../../core/utils/form-keyboard.util';
import { ButtonComponent } from '../../../shared/ui/button/button.component';
import { InputComponent } from '../../../shared/ui/form/input.component';
import { TextareaComponent } from '../../../shared/ui/form/textarea.component';
import { ComboboxComponent } from '../../../shared/ui/form/combobox.component';
import { SelectOption } from '../../../shared/ui/form/select.component';
import { IconComponent } from '../../../shared/ui/icon/icon.component';

export interface BranchFormDialogData {
  row: BranchRow | null; // null for 'add', present for 'edit'
  mode: 'add' | 'edit';
}

export type BranchFormDialogResult = boolean;

// Add/Edit Branch — not MasterFormDialogComponent-driven. See
// branch-list.component.ts's own comment for why. This is the single
// most involved Add/Edit dialog this session — see branch.model.ts's own
// comment for the full confirmed-live API writeup (the real
// save-with-locations endpoint, the location-options/get grid source,
// and the two real, non-obvious backend validation rules this discovered:
// "at least one location required" and "country/state/city/postalCode/
// area required once locations is non-empty"). Summary of this dialog's
// own logic:
//   - Company -> Country -> City -> Site is a client-side cascade (none
//     of CountryGetRequest/CityGetRequest/SiteGetRequest has a real
//     parent filter param — confirmed live, same finding as every other
//     cascade this session). Company does NOT affect Country eligibility
//     (CountryGetRequest has no companyId param) — confirmed, so Country
//     options are NOT filtered by the selected Company, and Company
//     changing does not reset Country/City/Site (this task's own
//     "Verify whether Company selection affects Country eligibility
//     before implementing that dependency" instruction, resolved: it
//     doesn't).
//   - State/Postal Code/Area are read-only, auto-populated directly from
//     the selected Site's own already-denormalized fields (no extra API
//     call needed) — never independently selected.
//   - The Branch Location Selection grid reloads via
//     master/branch/location-options/get whenever Site changes (to any
//     value, by any means, in either Add or Edit mode) — the server's own
//     response naturally reflects whether each row is currently assigned
//     to THIS branch (via the real branchId passed alongside siteId), so
//     no separate local "has this already been restored" bookkeeping is
//     needed; a request-token guard discards any response that is no
//     longer the latest in-flight request, preventing a stale response
//     from overwriting a later Site selection's own grid (this task's
//     own "Prevent stale asynchronous API responses..." instruction).
//   - CONFIRMED LIVE: Save requires at least one checked location row —
//     enforced here as real validation (not an invented restriction; see
//     branch.model.ts's own comment for the live probe that found this).
@Component({
  selector: 'app-branch-form-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, ButtonComponent, InputComponent, TextareaComponent, ComboboxComponent, IconComponent],
  templateUrl: './branch-form-dialog.component.html',
  styleUrl: './branch-form-dialog.component.scss',
})
export class BranchFormDialogComponent implements OnInit {
  private readonly masterApi = inject(MasterApiService);
  private readonly apiService = inject(ApiService);
  private readonly dialogService = inject(DialogService);
  protected readonly dialogRef = inject(DialogRef<BranchFormDialogResult>);

  protected readonly isEdit: boolean;
  protected readonly saving = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly form: FormGroup;

  protected readonly companiesLoading = signal(true);
  protected readonly companiesError = signal(false);
  protected readonly countriesLoading = signal(true);
  protected readonly countriesError = signal(false);
  protected readonly citiesLoading = signal(true);
  protected readonly citiesError = signal(false);
  protected readonly sitesLoading = signal(true);
  protected readonly sitesError = signal(false);

  // Preserve saved-but-now-ineligible selections on Edit — same pattern
  // as every other location Master's own rebuild this session.
  private savedCompanyOption: CompanyRow | null = null;
  private savedCountryOption: CountryRow | null = null;
  private savedCityOption: CityRow | null = null;
  private savedSiteOption: SiteRow | null = null;
  private readonly eligibleCompanies = signal<CompanyRow[]>([]);
  private readonly eligibleCountries = signal<CountryRow[]>([]);
  private readonly allCities = signal<CityRow[]>([]);
  private readonly allSites = signal<SiteRow[]>([]);

  protected readonly companyOptions = computed<SelectOption[]>(() => {
    const options = this.eligibleCompanies().map((c) => this.toCompanyOption(c));
    if (this.savedCompanyOption && !this.eligibleCompanies().some((c) => c.companyId === this.savedCompanyOption!.companyId)) {
      options.unshift(this.toCompanyOption(this.savedCompanyOption));
    }
    return options;
  });

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
  protected readonly selectedCountryId = signal<string>('');
  protected readonly selectedCityId = signal<string>('');
  protected readonly selectedSiteId = signal<string>('');
  // The FULL selected Site row (not just its id) — its own real
  // stateId/postalCodeId/areaId (and their denormalized code/name) drive
  // the read-only derived fields below, same "track the full parent
  // object" pattern as selectedBuilding in Room Master's own rebuild this
  // session.
  protected readonly selectedSite = signal<SiteRow | null>(null);

  protected readonly cityOptions = computed<SelectOption[]>(() => {
    const countryId = this.selectedCountryId();
    if (!countryId) return [];
    const filtered = this.allCities().filter((c) => c.countryId === countryId && c.isActive);
    const options = filtered.map((c) => this.toCityOption(c));
    if (this.savedCityOption && this.savedCityOption.countryId === countryId && !filtered.some((c) => c.cityId === this.savedCityOption!.cityId)) {
      options.unshift(this.toCityOption(this.savedCityOption));
    }
    return options;
  });

  protected readonly siteOptions = computed<SelectOption[]>(() => {
    const cityId = this.selectedCityId();
    if (!cityId) return [];
    const filtered = this.allSites().filter((s) => s.cityId === cityId && s.isActive);
    const options = filtered.map((s) => this.toSiteOption(s));
    if (this.savedSiteOption && this.savedSiteOption.cityId === cityId && !filtered.some((s) => s.siteId === this.savedSiteOption!.siteId)) {
      options.unshift(this.toSiteOption(this.savedSiteOption));
    }
    return options;
  });

  // --- Branch Location Selection grid ---
  protected readonly locationGridLoading = signal(false);
  protected readonly locationGridError = signal(false);
  protected readonly locationRows = signal<BranchLocationOptionRow[]>([]);
  protected readonly checkedWingIds = signal<Set<string>>(new Set());
  protected readonly selectedLocationCount = computed(() => this.checkedWingIds().size);
  // Discards a response that is no longer the latest in-flight request —
  // this file's own class-level comment ("Prevent stale asynchronous API
  // responses...").
  private locationRequestToken = 0;

  // Edit mode only: the Site resolved from the branch's own currently
  // assigned BranchLocation rows (see resolveSavedSiteFromExistingLocations()'s
  // own comment for why this can't come from BranchRow itself).
  private readonly editModeSiteId = signal<string | null>(null);

  constructor(@Inject(DIALOG_DATA) public data: BranchFormDialogData) {
    this.isEdit = data.mode === 'edit';
    const row = data.row;

    this.form = new FormGroup({
      branchId: new FormControl(row?.branchId ?? null),
      companyId: new FormControl(row?.companyId ?? '', [Validators.required]),
      branchCode: new FormControl(row?.branchCode ?? '', [Validators.required, Validators.maxLength(30)]),
      branchName: new FormControl(row?.branchName ?? '', [Validators.required, Validators.maxLength(200)]),
      addressLine1: new FormControl(row?.addressLine1 ?? ''),
      addressLine2: new FormControl(row?.addressLine2 ?? ''),
      addressLine3: new FormControl(row?.addressLine3 ?? ''),
      countryId: new FormControl(row?.countryId ?? '', [Validators.required]),
      cityId: new FormControl(row?.cityId ?? '', [Validators.required]),
      // CONFIRMED LIVE: BranchRow (master/branch/get) has no siteId field
      // at all — Site isn't stored directly on a Branch, only implied by
      // its own BranchLocation assignments. On Edit this control starts
      // empty and is restored asynchronously once
      // resolveSavedSiteFromExistingLocations() resolves the real Site
      // from the branch's own current master/branch/location/get rows
      // (see this file's own class-level comment and that method's own
      // comment).
      siteId: new FormControl('', [Validators.required]),
      // Read-only, always disabled — populated from the selected Site's
      // own real denormalized fields, never independently editable (this
      // task's own Section 2 "Row 5" instruction).
      stateDisplay: new FormControl({ value: '', disabled: true }),
      postalCodeDisplay: new FormControl({ value: '', disabled: true }),
      areaDisplay: new FormControl({ value: '', disabled: true }),
      phoneNo: new FormControl(row?.phoneNo ?? ''),
      alternatePhoneNo: new FormControl(row?.alternatePhoneNo ?? ''),
      emailId: new FormControl(row?.emailId ?? '', [Validators.email]),
      // Always blank, including on Edit — same confirmed-live
      // write-only-per-action changelog behavior as every other location
      // Master's own remarks fields this session.
      remarks: new FormControl(''),
    });

    // Both start disabled — "City dropdown: Initially disabled until a
    // valid Country is selected" / "Site dropdown: Initially disabled
    // until the required Country and City selections are valid" (this
    // task's own Section 4).
    this.form.get('cityId')!.disable({ emitEvent: false });
    this.form.get('siteId')!.disable({ emitEvent: false });

    // Registered AFTER the initial values above, so restoring a saved
    // row's own countryId/cityId on Edit does not immediately clear its
    // own already-correct dependents — only a genuine, later user-driven
    // change should do that. No subscription on companyId — Company does
    // NOT affect Country/City/Site eligibility (this file's own
    // class-level comment), so nothing needs to reset when it changes.
    this.form.get('countryId')!.valueChanges.subscribe((countryId: string) => {
      this.applySelectedCountry(countryId, true);
    });
    this.form.get('cityId')!.valueChanges.subscribe((cityId: string) => {
      this.applySelectedCity(cityId, true);
    });
    this.form.get('siteId')!.valueChanges.subscribe((siteId: string) => {
      this.applySelectedSite(siteId);
    });
  }

  ngOnInit(): void {
    this.loadCompanies();
    this.loadCountries();
    this.loadCities();
    this.loadSites();
    this.resolveSavedSiteFromExistingLocations();
  }

  // Edit mode only. CONFIRMED LIVE BranchRow has no siteId field — the
  // Site a Branch is associated with is only ever implied by its own
  // currently-assigned BranchLocation rows (master/branch/location/get),
  // not stored directly on the Branch itself. Resolves the real Site from
  // the first such row (if any), then restores the siteId control through
  // the normal applySelectedSite() path — which also loads the grid
  // pre-checked, since loadLocationOptions() always passes this real
  // branchId. Runs independently of loadSites(); whichever of the two
  // settles last is the one that actually resolves savedSiteOption /
  // triggers applySelectedSite() with real data (loadSites()'s own
  // success callback re-checks editModeSiteId() for exactly this reason).
  private resolveSavedSiteFromExistingLocations(): void {
    if (!this.isEdit || !this.data.row?.branchId) return;
    this.apiService.post<Record<string, unknown>, unknown>('master/branch/location/get', { branchId: this.data.row.branchId }).subscribe({
      next: (res) => {
        const rawRows = Array.isArray(res.data) ? res.data : [];
        const rows = rawRows.map((r) => normalizeRowKeys(r as Record<string, unknown>)) as unknown as BranchLocationOptionRow[];
        const firstSiteId = rows.length > 0 ? rows[0].siteId : null;
        if (!firstSiteId) return;
        this.editModeSiteId.set(firstSiteId);
        const existingSite = this.allSites().find((s) => s.siteId === firstSiteId);
        if (existingSite) this.savedSiteOption = existingSite;
        this.form.get('siteId')!.setValue(firstSiteId);
      },
      error: () => {
        // No usable location data to restore the Site from — the form
        // still works for everything else; Site simply stays unselected
        // and the user can re-pick it.
      },
    });
  }

  private toCompanyOption(c: CompanyRow): SelectOption {
    return { label: c.companyCode ? `${c.companyName} (${c.companyCode})` : (c.companyName ?? ''), value: c.companyId };
  }

  private toCountryOption(c: CountryRow): SelectOption {
    return { label: c.countryCode ? `${c.countryName} (${c.countryCode})` : (c.countryName ?? ''), value: c.countryId };
  }

  private toCityOption(c: CityRow): SelectOption {
    return { label: c.cityCode ? `${c.cityName} (${c.cityCode})` : (c.cityName ?? ''), value: c.cityId };
  }

  private toSiteOption(s: SiteRow): SelectOption {
    return { label: s.siteCode ? `${s.siteName} (${s.siteCode})` : (s.siteName ?? ''), value: s.siteId };
  }

  private formatDerived(name?: string | null, code?: string | null): string {
    if (!name) return '';
    return code ? `${name} (${code})` : name;
  }

  private applySelectedCountry(countryId: string, resetDependents: boolean): void {
    this.selectedCountryId.set(countryId);

    // Synchronous, not an effect() reacting to a computed signal later —
    // a form control's own enabled state should change in lockstep with
    // the action that caused it (see city-form-dialog.component.ts's own
    // comment this session for the async-effect() timing bug this
    // avoids).
    this.syncControlEnabled(this.form.get('cityId')!, !!countryId);

    if (resetDependents) {
      // Country changed — clear City and Site, and their own derived
      // State/Postal Code/Area, and the location grid (this task's own
      // "When Country changes: Clear City and Site. Clear State, Postal
      // Code and Area. Clear loaded location grid...").
      this.form.get('cityId')!.setValue('', { emitEvent: false });
      this.selectedCityId.set('');
      this.syncControlEnabled(this.form.get('siteId')!, false);
      this.form.get('siteId')!.setValue('', { emitEvent: false });
      this.clearDerivedSiteFieldsAndGrid();
    }
  }

  private applySelectedCity(cityId: string, resetDependents: boolean): void {
    this.selectedCityId.set(cityId);

    this.syncControlEnabled(this.form.get('siteId')!, !!cityId);

    if (resetDependents) {
      // City changed — clear Site, its own derived State/Postal Code/
      // Area, and the location grid (this task's own "When City changes:
      // Clear Site. Clear State, Postal Code and Area. Clear loaded
      // location grid...").
      this.form.get('siteId')!.setValue('', { emitEvent: false });
      this.clearDerivedSiteFieldsAndGrid();
    }
  }

  private clearDerivedSiteFieldsAndGrid(): void {
    this.selectedSiteId.set('');
    this.selectedSite.set(null);
    this.form.get('stateDisplay')!.setValue('', { emitEvent: false });
    this.form.get('postalCodeDisplay')!.setValue('', { emitEvent: false });
    this.form.get('areaDisplay')!.setValue('', { emitEvent: false });
    this.locationRequestToken++; // invalidate any in-flight grid request
    this.locationRows.set([]);
    this.checkedWingIds.set(new Set());
    this.locationGridLoading.set(false);
    this.locationGridError.set(false);
  }

  // Called for every Site change — a genuine user selection, a different
  // Site chosen mid-Edit, or the initial Edit-mode restoration alike.
  // Always reloads the grid for whatever Site is now selected; the real
  // server response (see loadLocationOptions()'s own comment) naturally
  // reflects whether each row is actually assigned to this branch, so no
  // separate reset-vs-restore branching is needed here.
  private applySelectedSite(siteId: string): void {
    this.selectedSiteId.set(siteId);
    const site = this.allSites().find((s) => s.siteId === siteId) ?? (this.savedSiteOption?.siteId === siteId ? this.savedSiteOption : null);
    this.selectedSite.set(site);

    this.form.get('stateDisplay')!.setValue(site ? this.formatDerived(site.stateName, site.stateCode) : '', { emitEvent: false });
    this.form.get('postalCodeDisplay')!.setValue(site?.postalCodeCode || site?.postalCodeName || '', { emitEvent: false });
    this.form.get('areaDisplay')!.setValue(site ? this.formatDerived(site.areaName, site.areaCode) : '', { emitEvent: false });

    if (siteId) {
      this.loadLocationOptions(siteId);
    } else {
      this.locationRequestToken++;
      this.locationRows.set([]);
      this.checkedWingIds.set(new Set());
      this.locationGridLoading.set(false);
      this.locationGridError.set(false);
    }
  }

  // CONFIRMED LIVE — master/branch/location-options/get{siteId,
  // branchId?} returns every real Building/Floor/Wing combination under
  // that Site, each already flagged with whether it is CURRENTLY assigned
  // to the given branchId (branchLocationId/isChecked) — see
  // branch.model.ts's own comment. Omitting branchId (Add mode, or any
  // Site with no prior assignment) naturally comes back with every row
  // unchecked.
  private loadLocationOptions(siteId: string): void {
    const token = ++this.locationRequestToken;
    this.locationGridLoading.set(true);
    this.locationGridError.set(false);
    const branchId = this.isEdit ? (this.data.row?.branchId ?? null) : null;
    this.apiService.post<Record<string, unknown>, unknown>('master/branch/location-options/get', { siteId, branchId }).subscribe({
      next: (res) => {
        if (token !== this.locationRequestToken) return; // stale — a later Site change already superseded this request
        this.locationGridLoading.set(false);
        const rawRows = Array.isArray(res.data) ? res.data : [];
        const rows = rawRows.map((r) => normalizeRowKeys(r as Record<string, unknown>)) as unknown as BranchLocationOptionRow[];
        this.locationRows.set(rows);
        const checked = new Set(rows.filter((r) => r.isChecked && r.wingId).map((r) => r.wingId as string));
        this.checkedWingIds.set(checked);
      },
      error: () => {
        if (token !== this.locationRequestToken) return;
        this.locationGridLoading.set(false);
        this.locationGridError.set(true);
        this.locationRows.set([]);
        this.checkedWingIds.set(new Set());
      },
    });
  }

  protected toggleLocationRow(row: BranchLocationOptionRow): void {
    if (!row.wingId) return;
    const next = new Set(this.checkedWingIds());
    if (next.has(row.wingId)) {
      next.delete(row.wingId);
    } else {
      next.add(row.wingId);
    }
    this.checkedWingIds.set(next);
  }

  protected isLocationRowChecked(row: BranchLocationOptionRow): boolean {
    return !!row.wingId && this.checkedWingIds().has(row.wingId);
  }

  private syncControlEnabled(control: AbstractControl, shouldBeEnabled: boolean): void {
    if (shouldBeEnabled) {
      if (control.disabled) control.enable({ emitEvent: false });
    } else if (control.enabled) {
      control.disable({ emitEvent: false });
    }
  }

  private loadCompanies(): void {
    this.companiesLoading.set(true);
    this.companiesError.set(false);
    this.masterApi.get<Record<string, unknown>, CompanyRow>('master/company', { searchText: null, isActive: null }).subscribe({
      next: (companies) => {
        this.companiesLoading.set(false);
        this.eligibleCompanies.set(companies.filter((c) => c.isActive));
        const savedId = this.data.row?.companyId;
        if (savedId) this.savedCompanyOption = companies.find((c) => c.companyId === savedId) ?? null;
      },
      error: () => {
        this.companiesLoading.set(false);
        this.companiesError.set(true);
      },
    });
  }

  private loadCountries(): void {
    this.countriesLoading.set(true);
    this.countriesError.set(false);
    this.masterApi.get<Record<string, unknown>, CountryRow>('master/country', { searchText: null, isActive: null }).subscribe({
      next: (countries) => {
        this.countriesLoading.set(false);
        // Only active countries that support City — the next required
        // level in this chain.
        this.eligibleCountries.set(countries.filter((c) => c.isActive && c.hasCity));
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

  private loadSites(): void {
    this.sitesLoading.set(true);
    this.sitesError.set(false);
    this.masterApi.get<Record<string, unknown>, SiteRow>('master/site', { searchText: null, isActive: null }).subscribe({
      next: (sites) => {
        this.sitesLoading.set(false);
        this.allSites.set(sites);
        // CONFIRMED LIVE BranchRow has no siteId field — read the real
        // saved Site id resolved by resolveSavedSiteFromExistingLocations()
        // instead (this file's own class-level comment).
        const savedId = this.editModeSiteId();
        if (savedId) this.savedSiteOption = sites.find((s) => s.siteId === savedId) ?? null;
        const currentSiteId = this.form.get('siteId')!.value;
        if (currentSiteId) this.applySelectedSite(currentSiteId);
      },
      error: () => {
        this.sitesLoading.set(false);
        this.sitesError.set(true);
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
    // CONFIRMED LIVE: the real backend rejects a save with zero locations
    // ("Select at least one Branch location.") — real, confirmed
    // validation, not an invented restriction (see branch.model.ts's own
    // comment).
    if (this.selectedLocationCount() === 0) {
      this.errorMessage.set('Select at least one Branch Location before saving.');
      return;
    }
    if (this.saving()) return;

    this.saving.set(true);
    this.errorMessage.set(null);

    const value = this.form.getRawValue();
    const site = this.selectedSite();
    const checkedRows = this.locationRows().filter((r) => r.wingId && this.checkedWingIds().has(r.wingId));
    const locations: BranchLocationItem[] = checkedRows.map((r) => ({
      siteId: r.siteId,
      buildingId: r.buildingId ?? null,
      floorId: r.floorId ?? null,
      wingId: r.wingId ?? null,
    }));

    const payload: BranchSaveRequest = {
      branchId: this.isEdit ? value.branchId : null,
      companyId: value.companyId,
      // Trim leading/trailing spaces — this task's own Section 7.
      branchCode: (value.branchCode || '').trim(),
      branchName: (value.branchName || '').trim(),
      addressLine1: (value.addressLine1 || '').trim() || null,
      addressLine2: (value.addressLine2 || '').trim() || null,
      addressLine3: (value.addressLine3 || '').trim() || null,
      countryId: value.countryId || null,
      // CONFIRMED LIVE: derived from the selected Site's own real chain,
      // never independently selected (see this file's own class-level
      // comment).
      stateId: site?.stateId ?? null,
      cityId: value.cityId || null,
      postalCodeId: site?.postalCodeId ?? null,
      areaId: site?.areaId ?? null,
      phoneNo: (value.phoneNo || '').trim() || null,
      alternatePhoneNo: (value.alternatePhoneNo || '').trim() || null,
      emailId: (value.emailId || '').trim() || null,
      remarks: value.remarks || null,
      locations,
    };

    this.apiService.post('master/branch/save-with-locations', payload).subscribe({
      next: (res) => {
        this.saving.set(false);
        if (res.success) {
          this.dialogRef.close(true);
        } else {
          this.errorMessage.set(usableMessage(res.message) ?? 'Failed to save this branch.');
        }
      },
      error: (err) => {
        this.saving.set(false);
        this.errorMessage.set(extractApiErrorMessage(err) ?? 'Something went wrong while saving this branch.');
      },
    });
  }

  // Cancel should warn about unsaved changes — this dialog's own form
  // starts untouched (Add) or matching the saved row exactly (Edit, aside
  // from Remarks, which always starts blank — see this file's own
  // constructor comment for why), so form.dirty reliably reflects real
  // unsaved work either way. Location-grid checkbox changes alone don't
  // mark the reactive form dirty, so they're tracked separately.
  protected onCancelClick(): void {
    if (this.form.dirty || this.locationSelectionsChanged()) {
      this.dialogService
        .open(ConfirmDialogComponent, {
          width: '420px',
          data: {
            title: 'Discard unsaved changes?',
            message: 'Your changes to this branch have not been saved.',
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

  // The grid's own checkbox state isn't part of the FormGroup, so
  // form.dirty alone can't tell whether the user changed any location
  // selections — compare the currently checked rows against what the
  // server's own isChecked flags said when the grid was last (re)loaded.
  private locationSelectionsChanged(): boolean {
    const serverChecked = new Set(this.locationRows().filter((r) => r.isChecked && r.wingId).map((r) => r.wingId as string));
    const current = this.checkedWingIds();
    if (serverChecked.size !== current.size) return true;
    for (const id of current) {
      if (!serverChecked.has(id)) return true;
    }
    return false;
  }
}
