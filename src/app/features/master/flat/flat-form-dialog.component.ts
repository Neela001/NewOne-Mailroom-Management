import { Component, Inject, OnInit, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { DIALOG_DATA } from '../../../shared/ui/dialog/dialog-data.token';
import { DialogRef } from '../../../shared/ui/dialog/dialog-ref';
import { DialogService } from '../../../shared/ui/dialog/dialog.service';
import { ConfirmDialogComponent } from '../shared/confirm-dialog.component';
import { MasterApiService } from '../shared/master-api.service';
import { FlatRow, FlatSaveRequest } from './flat.model';
import { SiteRow } from '../site/site.model';
import { BuildingRow } from '../building/building.model';
import { FloorRow } from '../floor/floor.model';
import { WingRow } from '../wing/wing.model';
import { extractApiErrorMessage, usableMessage } from '../../../core/utils/api-error.util';
import { handleFormEnterKey } from '../../../core/utils/form-keyboard.util';
import { ButtonComponent } from '../../../shared/ui/button/button.component';
import { InputComponent } from '../../../shared/ui/form/input.component';
import { TextareaComponent } from '../../../shared/ui/form/textarea.component';
import { ComboboxComponent } from '../../../shared/ui/form/combobox.component';
import { SelectOption } from '../../../shared/ui/form/select.component';

export interface FlatFormDialogData {
  row: FlatRow | null; // null for 'add', present for 'edit'
  mode: 'add' | 'edit';
}

export type FlatFormDialogResult = boolean;

// Add/Edit Flat — not MasterFormDialogComponent-driven. See
// flat-list.component.ts's own comment for why. This dialog's own
// reasons for being dedicated:
//   - Site -> Building -> Floor -> Wing 4-level dependency, one level
//     deeper than Wing Master's own Site -> Building -> Floor rebuild
//     this session. Building/Floor/Wing are each disabled until their own
//     parent is chosen, then client-side filtered to that parent's own
//     children — CONFIRMED LIVE none of BuildingGetRequest/
//     FloorGetRequest/WingGetRequest (used here purely as the lookup
//     source, not the real wing/get endpoint used elsewhere) has a filter
//     param that would make this server-side, so each level is a
//     client-side filter over one real fetch, narrowed by the selected
//     parent's own real id (already denormalized onto each child row).
//   - Building eligibility: ONLY active RESIDENTIAL buildings are
//     offered. This is a real, CONFIRMED-LIVE backend-enforced rule, not
//     an invented one — a real master/flat/add probe against a wing
//     under an active COMMERCIAL building was rejected with exactly
//     "Only active RESIDENTIAL buildings can have Flats." (see
//     flat.model.ts's own comment). The client-side filter here mirrors
//     that real rule rather than guessing it; if a previously saved
//     Building later becomes ineligible (deactivated or retyped), it is
//     still preserved as selectable on Edit (same "preserve existing
//     relationships" pattern as every other location Master's own
//     rebuild this session) — but a resubmit will surface the REAL
//     backend rejection message through this dialog's own errorMessage
//     signal, never a fabricated client-side-only warning.
//   - Site change clears Building, Floor AND Wing; Building change clears
//     Floor AND Wing; Floor change clears Wing only (this task's own
//     "Dependency reset rules").
//   - Flat Number: CONFIRMED LIVE a plain STRING on the real
//     FlatSaveRequest (unlike Floor Number, a real int32) — never coerced
//     through a number input or parsed to a number, to avoid dropping a
//     leading zero (same concern as postal codes this session).
@Component({
  selector: 'app-flat-form-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, ButtonComponent, InputComponent, TextareaComponent, ComboboxComponent],
  templateUrl: './flat-form-dialog.component.html',
  styleUrl: './flat-form-dialog.component.scss',
})
export class FlatFormDialogComponent implements OnInit {
  private readonly masterApi = inject(MasterApiService);
  private readonly dialogService = inject(DialogService);
  protected readonly dialogRef = inject(DialogRef<FlatFormDialogResult>);

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
  protected readonly wingsLoading = signal(true);
  protected readonly wingsError = signal(false);

  // The row's own saved Site/Building/Floor/Wing are preserved as
  // selectable even if no longer eligible (e.g. Building deactivated or
  // retyped) by the time this dialog opens for Edit — same "preserve
  // existing relationships" pattern as every other location Master's own
  // rebuild this session (see this file's own class-level comment for why
  // Building specifically still relies on the real backend to reject an
  // invalid resubmit rather than a fabricated client-side warning).
  private savedSiteOption: SiteRow | null = null;
  private savedBuildingOption: BuildingRow | null = null;
  private savedFloorOption: FloorRow | null = null;
  private savedWingOption: WingRow | null = null;
  private readonly eligibleSites = signal<SiteRow[]>([]);
  private readonly allBuildings = signal<BuildingRow[]>([]);
  private readonly allFloors = signal<FloorRow[]>([]);
  private readonly allWings = signal<WingRow[]>([]);

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
    // Only active RESIDENTIAL buildings — this task's own Section 3/4
    // mandatory business rule, CONFIRMED LIVE backend-enforced (see this
    // file's own class-level comment).
    const filtered = this.allBuildings().filter((b) => b.siteId === siteId && b.isActive && b.buildingType === 'RESIDENTIAL');
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

  protected readonly wingOptions = computed<SelectOption[]>(() => {
    const floorId = this.selectedFloorId();
    if (!floorId) return [];
    const filtered = this.allWings().filter((w) => w.floorId === floorId && w.isActive);
    const options = filtered.map((w) => this.toWingOption(w));
    if (this.savedWingOption && this.savedWingOption.floorId === floorId && !filtered.some((w) => w.wingId === this.savedWingOption!.wingId)) {
      options.unshift(this.toWingOption(this.savedWingOption));
    }
    return options;
  });

  constructor(@Inject(DIALOG_DATA) public data: FlatFormDialogData) {
    this.isEdit = data.mode === 'edit';
    const row = data.row;

    this.form = new FormGroup({
      flatId: new FormControl(row?.flatId ?? null),
      siteId: new FormControl(row?.siteId ?? '', [Validators.required]),
      buildingId: new FormControl(row?.buildingId ?? '', [Validators.required]),
      floorId: new FormControl(row?.floorId ?? '', [Validators.required]),
      wingId: new FormControl(row?.wingId ?? '', [Validators.required]),
      flatCode: new FormControl(row?.flatCode ?? '', [Validators.required, Validators.maxLength(50)]),
      // Plain text, never number — see this file's own class-level
      // comment and flat.model.ts's own comment for why (preserves a
      // leading-zero flat number exactly as typed).
      flatNumber: new FormControl(row?.flatNumber ?? '', [Validators.required, Validators.maxLength(20)]),
      flatName: new FormControl(row?.flatName ?? '', [Validators.required, Validators.maxLength(200)]),
      // Always blank, including on Edit — same confirmed-live
      // write-only-per-action changelog behavior as every other location
      // Master's own remarks fields this session.
      remarks: new FormControl(''),
    });

    // All three dependent levels start disabled — "Building dropdown:
    // Initially disabled until a Site is selected" / "Floor dropdown:
    // Initially disabled until an eligible Building is selected" / "Wing
    // dropdown: Initially disabled until a valid Floor is selected"
    // (this task's own Section 3).
    this.form.get('buildingId')!.disable({ emitEvent: false });
    this.form.get('floorId')!.disable({ emitEvent: false });
    this.form.get('wingId')!.disable({ emitEvent: false });

    // Registered AFTER the initial values above, so restoring a saved
    // row's own siteId/buildingId/floorId on Edit does not immediately
    // clear its own already-correct dependents — only a genuine, later
    // user-driven change should do that.
    this.form.get('siteId')!.valueChanges.subscribe((siteId: string) => {
      this.applySelectedSite(siteId, true);
    });
    this.form.get('buildingId')!.valueChanges.subscribe((buildingId: string) => {
      this.applySelectedBuilding(buildingId, true);
    });
    this.form.get('floorId')!.valueChanges.subscribe((floorId: string) => {
      this.applySelectedFloor(floorId, true);
    });
  }

  ngOnInit(): void {
    this.loadSites();
    this.loadBuildings();
    this.loadFloors();
    this.loadWings();
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

  private toWingOption(w: WingRow): SelectOption {
    return { label: w.wingCode ? `${w.wingName} (${w.wingCode})` : (w.wingName ?? ''), value: w.wingId };
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
      // Site changed — clear Building, Floor AND Wing (this task's own
      // "Dependency reset rules": "Site changes -> clear Building, Floor
      // and Wing").
      buildingControl.setValue('', { emitEvent: false });
      this.selectedBuildingId.set('');
      const floorControl = this.form.get('floorId')!;
      floorControl.setValue('', { emitEvent: false });
      this.selectedFloorId.set('');
      if (floorControl.enabled) floorControl.disable({ emitEvent: false });
      const wingControl = this.form.get('wingId')!;
      wingControl.setValue('', { emitEvent: false });
      if (wingControl.enabled) wingControl.disable({ emitEvent: false });
    }
  }

  private applySelectedBuilding(buildingId: string, resetDependents: boolean): void {
    this.selectedBuildingId.set(buildingId);

    const floorControl = this.form.get('floorId')!;
    if (buildingId) {
      if (floorControl.disabled) floorControl.enable({ emitEvent: false });
    } else if (floorControl.enabled) {
      floorControl.disable({ emitEvent: false });
    }

    if (resetDependents) {
      // Building changed — clear Floor AND Wing (this task's own
      // "Dependency reset rules": "Building changes -> clear Floor and
      // Wing").
      floorControl.setValue('', { emitEvent: false });
      this.selectedFloorId.set('');
      const wingControl = this.form.get('wingId')!;
      wingControl.setValue('', { emitEvent: false });
      if (wingControl.enabled) wingControl.disable({ emitEvent: false });
    }
  }

  private applySelectedFloor(floorId: string, resetWing: boolean): void {
    this.selectedFloorId.set(floorId);

    const wingControl = this.form.get('wingId')!;
    if (floorId) {
      if (wingControl.disabled) wingControl.enable({ emitEvent: false });
    } else if (wingControl.enabled) {
      wingControl.disable({ emitEvent: false });
    }

    if (resetWing) {
      // Floor changed — clear Wing only (this task's own "Dependency
      // reset rules": "Floor changes -> clear Wing").
      wingControl.setValue('', { emitEvent: false });
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
        const currentFloorId = this.form.get('floorId')!.value;
        if (currentFloorId) this.applySelectedFloor(currentFloorId, false);
      },
      error: () => {
        this.floorsLoading.set(false);
        this.floorsError.set(true);
      },
    });
  }

  private loadWings(): void {
    this.wingsLoading.set(true);
    this.wingsError.set(false);
    this.masterApi.get<Record<string, unknown>, WingRow>('master/wing', { searchText: null, isActive: null }).subscribe({
      next: (wings) => {
        this.wingsLoading.set(false);
        this.allWings.set(wings);
        const savedId = this.data.row?.wingId;
        if (savedId) this.savedWingOption = wings.find((w) => w.wingId === savedId) ?? null;
      },
      error: () => {
        this.wingsLoading.set(false);
        this.wingsError.set(true);
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
    const payload: FlatSaveRequest = {
      flatId: this.isEdit ? value.flatId : null,
      siteId: value.siteId,
      buildingId: value.buildingId,
      floorId: value.floorId,
      wingId: value.wingId,
      // Trim leading/trailing spaces — this task's own Section 7.
      flatCode: (value.flatCode || '').trim() || null,
      flatName: (value.flatName || '').trim(),
      // Plain string, never a parsed number — see this file's own
      // class-level comment.
      flatNumber: (value.flatNumber || '').trim(),
      remarks: value.remarks || null,
    };

    const request$ = this.isEdit ? this.masterApi.edit('master/flat', payload) : this.masterApi.add('master/flat', payload);
    request$.subscribe({
      next: (res) => {
        this.saving.set(false);
        if (res.success) {
          this.dialogRef.close(true);
        } else {
          // Surfaces the REAL backend message here if it ever fires — e.g.
          // "Only active RESIDENTIAL buildings can have Flats." for a
          // previously-saved Building that has since become ineligible
          // (this file's own class-level comment).
          this.errorMessage.set(usableMessage(res.message) ?? 'Failed to save this flat.');
        }
      },
      error: (err) => {
        this.saving.set(false);
        this.errorMessage.set(extractApiErrorMessage(err) ?? 'Something went wrong while saving this flat.');
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
            message: 'Your changes to this flat have not been saved.',
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
