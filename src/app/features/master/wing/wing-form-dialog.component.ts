import { Component, Inject, OnInit, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { DIALOG_DATA } from '../../../shared/ui/dialog/dialog-data.token';
import { DialogRef } from '../../../shared/ui/dialog/dialog-ref';
import { DialogService } from '../../../shared/ui/dialog/dialog.service';
import { ConfirmDialogComponent } from '../shared/confirm-dialog.component';
import { MasterApiService } from '../shared/master-api.service';
import { WingRow, WingSaveRequest } from './wing.model';
import { SiteRow } from '../site/site.model';
import { BuildingRow } from '../building/building.model';
import { FloorRow } from '../floor/floor.model';
import { extractApiErrorMessage, usableMessage } from '../../../core/utils/api-error.util';
import { handleFormEnterKey } from '../../../core/utils/form-keyboard.util';
import { ButtonComponent } from '../../../shared/ui/button/button.component';
import { InputComponent } from '../../../shared/ui/form/input.component';
import { TextareaComponent } from '../../../shared/ui/form/textarea.component';
import { ComboboxComponent } from '../../../shared/ui/form/combobox.component';
import { SelectOption } from '../../../shared/ui/form/select.component';

export interface WingFormDialogData {
  row: WingRow | null; // null for 'add', present for 'edit'
  mode: 'add' | 'edit';
}

export type WingFormDialogResult = boolean;

// Add/Edit Wing — not MasterFormDialogComponent-driven. See
// wing-list.component.ts's own comment for why. This dialog's own
// reasons for being dedicated:
//   - Site -> Building -> Floor 3-level dependency, one level deeper than
//     Floor Master's own Site -> Building rebuild this session. Building
//     is disabled until a Site is chosen, then client-side filtered to
//     that Site's own buildings; Floor is disabled until a Building is
//     chosen, then client-side filtered to that Building's own floors.
//     CONFIRMED LIVE neither BuildingGetRequest nor FloorGetRequest has a
//     siteId/buildingId filter param of its own (same finding as every
//     cascading dropdown this session), so both are client-side filters
//     over one real fetch each, narrowed by the selected parent's own
//     real id (already denormalized onto each child row).
//   - Site change clears Building AND Floor; Building change clears Floor
//     only; Floor change retains Site and Building (this task's own
//     "Dependency reset rules").
//   - Single-column, full-width layout (NOT the two-column layout every
//     other entity this session used) — this task's own explicit Section
//     2/7 instruction, matching the real Windows reference screenshot.
//   - Dynamic footer helper text ("Select Site to continue." / "Select
//     Building to continue." / "Select Floor to continue." / a completion
//     hint once all three are chosen) — this task's own explicit Section
//     2 instruction.
//   - Edit mode uses a distinct "Update Wing" submit button label (same
//     explicit per-task pattern as Building/Floor Master's own "Update
//     Building"/"Update Floor" this session).
@Component({
  selector: 'app-wing-form-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, ButtonComponent, InputComponent, TextareaComponent, ComboboxComponent],
  templateUrl: './wing-form-dialog.component.html',
  styleUrl: './wing-form-dialog.component.scss',
})
export class WingFormDialogComponent implements OnInit {
  private readonly masterApi = inject(MasterApiService);
  private readonly dialogService = inject(DialogService);
  protected readonly dialogRef = inject(DialogRef<WingFormDialogResult>);

  protected readonly isEdit: boolean;
  protected readonly saving = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly form: FormGroup;

  protected readonly sitesLoading = signal(true);
  protected readonly sitesError = signal(false);
  protected readonly buildingsLoading = signal(true);
  protected readonly buildingsError = signal(false);
  protected readonly floorsLoading = signal(true);
  protected readonly floorsError = signal(false);

  // The row's own saved Site/Building/Floor are preserved as selectable
  // even if no longer eligible (e.g. deactivated) by the time this dialog
  // opens for Edit — same "preserve existing relationships" pattern as
  // every other location-dropdown Master's own rebuild this session.
  private savedSiteOption: SiteRow | null = null;
  private savedBuildingOption: BuildingRow | null = null;
  private savedFloorOption: FloorRow | null = null;
  private readonly eligibleSites = signal<SiteRow[]>([]);
  private readonly allBuildings = signal<BuildingRow[]>([]);
  private readonly allFloors = signal<FloorRow[]>([]);

  protected readonly siteOptions = computed<SelectOption[]>(() => {
    const options = this.eligibleSites().map((s) => this.toSiteOption(s));
    if (this.savedSiteOption && !this.eligibleSites().some((s) => s.siteId === this.savedSiteOption!.siteId)) {
      options.unshift(this.toSiteOption(this.savedSiteOption));
    }
    return options;
  });

  // Plain signals set explicitly from valueChanges/initial-load callbacks,
  // NOT computed() reading FormControl.value directly — see
  // uploadfiles-upload-dialog.component.ts's own comment this session for
  // why that would cache its first read forever.
  protected readonly selectedSiteId = signal<string>('');
  protected readonly selectedBuildingId = signal<string>('');
  protected readonly selectedFloorId = signal<string>('');

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

  protected readonly floorOptions = computed<SelectOption[]>(() => {
    const buildingId = this.selectedBuildingId();
    if (!buildingId) return [];
    const filtered = this.allFloors().filter((f) => f.buildingId === buildingId && f.isActive);
    const options = filtered.map((f) => this.toFloorOption(f));
    if (this.savedFloorOption && this.savedFloorOption.buildingId === buildingId && !filtered.some((f) => f.floorId === this.savedFloorOption!.floorId)) {
      options.unshift(this.toFloorOption(this.savedFloorOption));
    }
    return options;
  });

  // Dynamic "Select X to continue." footer guidance — this task's own
  // explicit Section 2 instruction.
  protected readonly helperText = computed(() => {
    if (!this.selectedSiteId()) return 'Select Site to continue.';
    if (!this.selectedBuildingId()) return 'Select Building to continue.';
    if (!this.selectedFloorId()) return 'Select Floor to continue.';
    return 'Enter Wing Code and Wing Name, then save.';
  });

  constructor(@Inject(DIALOG_DATA) public data: WingFormDialogData) {
    this.isEdit = data.mode === 'edit';
    const row = data.row;

    this.form = new FormGroup({
      wingId: new FormControl(row?.wingId ?? null),
      siteId: new FormControl(row?.siteId ?? '', [Validators.required]),
      buildingId: new FormControl(row?.buildingId ?? '', [Validators.required]),
      floorId: new FormControl(row?.floorId ?? '', [Validators.required]),
      wingCode: new FormControl(row?.wingCode ?? '', [Validators.required, Validators.maxLength(50)]),
      wingName: new FormControl(row?.wingName ?? '', [Validators.required, Validators.maxLength(200)]),
      // Always blank, including on Edit — same confirmed-live
      // write-only-per-action changelog behavior as every other location
      // Master's own remarks fields this session.
      remarks: new FormControl(''),
    });

    // Both start disabled — "Building dropdown: Initially disabled until
    // a valid Site is selected" / "Floor dropdown: Initially disabled
    // until a valid Building is selected" (this task's own Section 3).
    this.form.get('buildingId')!.disable({ emitEvent: false });
    this.form.get('floorId')!.disable({ emitEvent: false });

    // Registered AFTER the initial values above, so restoring a saved
    // row's own siteId/buildingId on Edit does not immediately clear its
    // own already-correct dependents — only a genuine, later user-driven
    // change should do that.
    this.form.get('siteId')!.valueChanges.subscribe((siteId: string) => {
      this.applySelectedSite(siteId, true);
    });
    this.form.get('buildingId')!.valueChanges.subscribe((buildingId: string) => {
      this.applySelectedBuilding(buildingId, true);
    });
    this.form.get('floorId')!.valueChanges.subscribe((floorId: string) => {
      this.selectedFloorId.set(floorId);
    });
    this.selectedFloorId.set(this.form.get('floorId')!.value);
  }

  ngOnInit(): void {
    this.loadSites();
    this.loadBuildings();
    this.loadFloors();
  }

  private toSiteOption(s: SiteRow): SelectOption {
    return { label: s.siteCode ? `${s.siteName} (${s.siteCode})` : (s.siteName ?? ''), value: s.siteId };
  }

  private toBuildingOption(b: BuildingRow): SelectOption {
    return { label: b.buildingCode ? `${b.buildingName} (${b.buildingCode})` : (b.buildingName ?? ''), value: b.buildingId };
  }

  private toFloorOption(f: FloorRow): SelectOption {
    return { label: f.floorCode ? `${f.floorName} (${f.floorCode})` : (f.floorName ?? ''), value: f.floorId };
  }

  private applySelectedSite(siteId: string, resetDependents: boolean): void {
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

    if (resetDependents) {
      // Site changed — clear Building AND Floor (this task's own
      // "Dependency reset rules": "Site changes -> clear Building and
      // Floor").
      buildingControl.setValue('', { emitEvent: false });
      this.selectedBuildingId.set('');
      const floorControl = this.form.get('floorId')!;
      floorControl.setValue('', { emitEvent: false });
      this.selectedFloorId.set('');
      if (floorControl.enabled) floorControl.disable({ emitEvent: false });
    }
  }

  private applySelectedBuilding(buildingId: string, resetFloor: boolean): void {
    this.selectedBuildingId.set(buildingId);

    const floorControl = this.form.get('floorId')!;
    if (buildingId) {
      if (floorControl.disabled) floorControl.enable({ emitEvent: false });
    } else if (floorControl.enabled) {
      floorControl.disable({ emitEvent: false });
    }

    if (resetFloor) {
      // Building changed — clear Floor only (this task's own "Dependency
      // reset rules": "Building changes -> clear Floor").
      floorControl.setValue('', { emitEvent: false });
      this.selectedFloorId.set('');
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
        const currentBuildingId = this.form.get('buildingId')!.value;
        if (currentBuildingId) this.applySelectedBuilding(currentBuildingId, false);
      },
      error: () => {
        this.buildingsLoading.set(false);
        this.buildingsError.set(true);
      },
    });
  }

  private loadFloors(): void {
    this.floorsLoading.set(true);
    this.floorsError.set(false);
    this.masterApi.get<Record<string, unknown>, FloorRow>('master/floor', { searchText: null, isActive: null }).subscribe({
      next: (floors) => {
        this.floorsLoading.set(false);
        this.allFloors.set(floors);
        const savedId = this.data.row?.floorId;
        if (savedId) this.savedFloorOption = floors.find((f) => f.floorId === savedId) ?? null;
      },
      error: () => {
        this.floorsLoading.set(false);
        this.floorsError.set(true);
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
    const payload: WingSaveRequest = {
      wingId: this.isEdit ? value.wingId : null,
      siteId: value.siteId,
      buildingId: value.buildingId,
      floorId: value.floorId,
      // Trim leading/trailing spaces — this task's own Section 6.
      wingCode: (value.wingCode || '').trim() || null,
      wingName: (value.wingName || '').trim(),
      remarks: value.remarks || null,
    };

    const request$ = this.isEdit ? this.masterApi.edit('master/wing', payload) : this.masterApi.add('master/wing', payload);
    request$.subscribe({
      next: (res) => {
        this.saving.set(false);
        if (res.success) {
          this.dialogRef.close(true);
        } else {
          this.errorMessage.set(usableMessage(res.message) ?? 'Failed to save this wing.');
        }
      },
      error: (err) => {
        this.saving.set(false);
        this.errorMessage.set(extractApiErrorMessage(err) ?? 'Something went wrong while saving this wing.');
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
            message: 'Your changes to this wing have not been saved.',
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
