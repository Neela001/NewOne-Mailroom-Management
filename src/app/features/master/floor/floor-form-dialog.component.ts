import { Component, Inject, OnInit, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { DIALOG_DATA } from '../../../shared/ui/dialog/dialog-data.token';
import { DialogRef } from '../../../shared/ui/dialog/dialog-ref';
import { DialogService } from '../../../shared/ui/dialog/dialog.service';
import { ConfirmDialogComponent } from '../shared/confirm-dialog.component';
import { MasterApiService } from '../shared/master-api.service';
import { FloorRow, FloorSaveRequest } from './floor.model';
import { SiteRow } from '../site/site.model';
import { BuildingRow } from '../building/building.model';
import { extractApiErrorMessage, usableMessage } from '../../../core/utils/api-error.util';
import { handleFormEnterKey } from '../../../core/utils/form-keyboard.util';
import { ButtonComponent } from '../../../shared/ui/button/button.component';
import { InputComponent } from '../../../shared/ui/form/input.component';
import { TextareaComponent } from '../../../shared/ui/form/textarea.component';
import { ComboboxComponent } from '../../../shared/ui/form/combobox.component';
import { SelectOption } from '../../../shared/ui/form/select.component';

export interface FloorFormDialogData {
  row: FloorRow | null; // null for 'add', present for 'edit'
  mode: 'add' | 'edit';
}

export type FloorFormDialogResult = boolean;

// Add/Edit Floor — not MasterFormDialogComponent-driven. See
// floor-list.component.ts's own comment for why. This dialog's own
// reasons for being dedicated:
//   - Site dropdown: real master/site/get rows, full-width eligibility
//     left to the backend's own isActive flag (this task's own "Follow
//     existing backend eligibility rules" — same active-only pattern as
//     every other location-dropdown Master's own rebuild this session).
//   - Building dropdown: disabled until a Site is selected, then
//     client-side filtered to that Site's own real buildings. CONFIRMED
//     LIVE BuildingGetRequest has no siteId filter param (same finding as
//     every cascading dropdown this session), so this is a client-side
//     filter over one real master/building/get fetch, narrowed by the
//     selected Site's own real siteId (already denormalized onto each
//     building row).
//   - Site change clears Building (this task's own "Dependency reset
//     rules").
//   - Floor Number: CONFIRMED LIVE a real, separate, nullable int32 field
//     on FloorRequest (Swagger) — NOT present in the existing generic
//     floor.config.ts's own formFields. 0 and negative values (basement
//     levels) are real, valid floor numbers, so this field is handled
//     with `!= null` / `=== ''` checks everywhere, never `||` or truthy
//     checks, which would incorrectly treat a real 0 as empty (see
//     applyFloorNumberFromRow() and onSubmit()'s own comments).
//   - Edit mode uses a distinct "Update Floor" submit button label (same
//     explicit per-task instruction as Building Master's own "Update
//     Building" this session).
@Component({
  selector: 'app-floor-form-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, ButtonComponent, InputComponent, TextareaComponent, ComboboxComponent],
  templateUrl: './floor-form-dialog.component.html',
  styleUrl: './floor-form-dialog.component.scss',
})
export class FloorFormDialogComponent implements OnInit {
  private readonly masterApi = inject(MasterApiService);
  private readonly dialogService = inject(DialogService);
  protected readonly dialogRef = inject(DialogRef<FloorFormDialogResult>);

  protected readonly isEdit: boolean;
  protected readonly saving = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly form: FormGroup;

  protected readonly sitesLoading = signal(true);
  protected readonly sitesError = signal(false);
  protected readonly buildingsLoading = signal(true);
  protected readonly buildingsError = signal(false);

  // The row's own saved Site/Building are preserved as selectable even if
  // no longer eligible (e.g. deactivated) by the time this dialog opens
  // for Edit — same "preserve existing relationships" pattern as every
  // other location-dropdown Master's own rebuild this session.
  private savedSiteOption: SiteRow | null = null;
  private savedBuildingOption: BuildingRow | null = null;
  private readonly eligibleSites = signal<SiteRow[]>([]);
  private readonly allBuildings = signal<BuildingRow[]>([]);

  protected readonly siteOptions = computed<SelectOption[]>(() => {
    const options = this.eligibleSites().map((s) => this.toSiteOption(s));
    if (this.savedSiteOption && !this.eligibleSites().some((s) => s.siteId === this.savedSiteOption!.siteId)) {
      options.unshift(this.toSiteOption(this.savedSiteOption));
    }
    return options;
  });

  // A plain signal set explicitly, NOT a computed() reading
  // form.get('siteId')!.value directly — see uploadfiles-upload-dialog.
  // component.ts's own comment this session for why a computed() reading
  // a FormControl's plain .value would cache its first result forever.
  protected readonly selectedSiteId = signal<string>('');

  protected readonly buildingOptions = computed<SelectOption[]>(() => {
    const siteId = this.selectedSiteId();
    if (!siteId) return [];
    const filtered = this.allBuildings().filter((b) => b.siteId === siteId && b.isActive);
    const options = filtered.map((b) => this.toBuildingOption(b));
    if (this.savedBuildingOption && this.savedBuildingOption.siteId === siteId && !filtered.some((b) => b.buildingId === this.savedBuildingOption!.buildingId)) {
      options.unshift(this.toBuildingOption(this.savedBuildingOption));
    }
    return options;
  });

  constructor(@Inject(DIALOG_DATA) public data: FloorFormDialogData) {
    this.isEdit = data.mode === 'edit';
    const row = data.row;

    this.form = new FormGroup({
      floorId: new FormControl(row?.floorId ?? null),
      siteId: new FormControl(row?.siteId ?? '', [Validators.required]),
      buildingId: new FormControl(row?.buildingId ?? '', [Validators.required]),
      floorCode: new FormControl(row?.floorCode ?? '', [Validators.required, Validators.maxLength(50)]),
      floorName: new FormControl(row?.floorName ?? '', [Validators.required, Validators.maxLength(200)]),
      // Held as a string (InputComponent's own CVA always emits strings),
      // converted back to a real number (or null) only in onSubmit() — see
      // this file's own class-level comment for why `!= null`/`=== ''`
      // checks are used instead of truthy checks throughout.
      floorNumber: new FormControl(row?.floorNumber != null ? String(row.floorNumber) : ''),
      // Always blank, including on Edit — same confirmed-live
      // write-only-per-action changelog behavior as every other location
      // Master's own remarks fields this session.
      remarks: new FormControl(''),
    });

    // Starts disabled — "Building dropdown: Initially disabled until a
    // valid Site is selected" (this task's own Section 3).
    this.form.get('buildingId')!.disable({ emitEvent: false });

    // Registered AFTER the initial values above, so restoring the saved
    // siteId on Edit does not immediately clear the saved buildingId —
    // only a genuine, later user-driven change should do that.
    this.form.get('siteId')!.valueChanges.subscribe((siteId: string) => {
      this.applySelectedSite(siteId, true);
    });
  }

  ngOnInit(): void {
    this.loadSites();
    this.loadBuildings();
  }

  private toSiteOption(s: SiteRow): SelectOption {
    return { label: s.siteCode ? `${s.siteName} (${s.siteCode})` : (s.siteName ?? ''), value: s.siteId };
  }

  private toBuildingOption(b: BuildingRow): SelectOption {
    return { label: b.buildingCode ? `${b.buildingName} (${b.buildingCode})` : (b.buildingName ?? ''), value: b.buildingId };
  }

  private applySelectedSite(siteId: string, clearBuilding: boolean): void {
    this.selectedSiteId.set(siteId);

    // Synchronous, not an effect() reacting to a computed signal later —
    // a form control's own enabled state should change in lockstep with
    // the action that caused it (see city-form-dialog.component.ts's own
    // comment this session for the async-effect() timing bug this
    // avoids).
    const buildingControl = this.form.get('buildingId')!;
    if (siteId) {
      if (buildingControl.disabled) buildingControl.enable({ emitEvent: false });
    } else if (buildingControl.enabled) {
      buildingControl.disable({ emitEvent: false });
    }

    if (clearBuilding) {
      // Site changed — clear Building (this task's own "Dependency reset
      // rules": "When Site changes, clear the selected Building").
      buildingControl.setValue('', { emitEvent: false });
    }
  }

  private loadSites(): void {
    this.sitesLoading.set(true);
    this.sitesError.set(false);
    this.masterApi.get<Record<string, unknown>, SiteRow>('master/site', { searchText: null, isActive: null }).subscribe({
      next: (sites) => {
        this.sitesLoading.set(false);
        this.eligibleSites.set(sites.filter((s) => s.isActive));
        const savedId = this.data.row?.siteId;
        if (savedId) this.savedSiteOption = sites.find((s) => s.siteId === savedId) ?? null;
        const currentSiteId = this.form.get('siteId')!.value;
        if (currentSiteId) this.applySelectedSite(currentSiteId, false);
      },
      error: () => {
        this.sitesLoading.set(false);
        this.sitesError.set(true);
      },
    });
  }

  private loadBuildings(): void {
    this.buildingsLoading.set(true);
    this.buildingsError.set(false);
    this.masterApi.get<Record<string, unknown>, BuildingRow>('master/building', { searchText: null, isActive: null }).subscribe({
      next: (buildings) => {
        this.buildingsLoading.set(false);
        this.allBuildings.set(buildings);
        const savedId = this.data.row?.buildingId;
        if (savedId) this.savedBuildingOption = buildings.find((b) => b.buildingId === savedId) ?? null;
      },
      error: () => {
        this.buildingsLoading.set(false);
        this.buildingsError.set(true);
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
    // Floor Number: an empty string means "not provided" (null); any other
    // value — including "0" and "-1" — is a real floor number. Never use a
    // truthy/`||` check here, which would silently turn a real ground-floor
    // 0 into null (this task's own explicit "Do not treat zero as an empty
    // value").
    const floorNumberRaw: string = value.floorNumber;
    const floorNumber = floorNumberRaw === '' || floorNumberRaw == null ? null : Number(floorNumberRaw);
    const payload: FloorSaveRequest = {
      floorId: this.isEdit ? value.floorId : null,
      siteId: value.siteId,
      buildingId: value.buildingId,
      // Trim leading/trailing spaces — this task's own Section 6.
      floorCode: (value.floorCode || '').trim() || null,
      floorName: (value.floorName || '').trim(),
      floorNumber: floorNumber != null && Number.isNaN(floorNumber) ? null : floorNumber,
      remarks: value.remarks || null,
    };

    const request$ = this.isEdit ? this.masterApi.edit('master/floor', payload) : this.masterApi.add('master/floor', payload);
    request$.subscribe({
      next: (res) => {
        this.saving.set(false);
        if (res.success) {
          this.dialogRef.close(true);
        } else {
          this.errorMessage.set(usableMessage(res.message) ?? 'Failed to save this floor.');
        }
      },
      error: (err) => {
        this.saving.set(false);
        this.errorMessage.set(extractApiErrorMessage(err) ?? 'Something went wrong while saving this floor.');
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
            message: 'Your changes to this floor have not been saved.',
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
