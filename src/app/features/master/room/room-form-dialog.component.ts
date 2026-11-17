import { Component, Inject, OnInit, computed, inject, signal } from '@angular/core';
import { AbstractControl, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { DIALOG_DATA } from '../../../shared/ui/dialog/dialog-data.token';
import { DialogRef } from '../../../shared/ui/dialog/dialog-ref';
import { DialogService } from '../../../shared/ui/dialog/dialog.service';
import { ConfirmDialogComponent } from '../shared/confirm-dialog.component';
import { MasterApiService } from '../shared/master-api.service';
import { RoomRow, RoomSaveRequest } from './room.model';
import { SiteRow } from '../site/site.model';
import { BuildingRow } from '../building/building.model';
import { FloorRow } from '../floor/floor.model';
import { WingRow } from '../wing/wing.model';
import { FlatRow } from '../flat/flat.model';
import { extractApiErrorMessage, usableMessage } from '../../../core/utils/api-error.util';
import { handleFormEnterKey } from '../../../core/utils/form-keyboard.util';
import { ButtonComponent } from '../../../shared/ui/button/button.component';
import { InputComponent } from '../../../shared/ui/form/input.component';
import { TextareaComponent } from '../../../shared/ui/form/textarea.component';
import { ComboboxComponent } from '../../../shared/ui/form/combobox.component';
import { SelectOption } from '../../../shared/ui/form/select.component';

export interface RoomFormDialogData {
  row: RoomRow | null; // null for 'add', present for 'edit'
  mode: 'add' | 'edit';
}

export type RoomFormDialogResult = boolean;

// Add/Edit Room — not MasterFormDialogComponent-driven. See
// room-list.component.ts's own comment for why. This dialog's own
// reasons for being dedicated:
//   - Site -> Building -> Floor -> Wing required 4-level chain, plus an
//     OPTIONAL 5th Flat level gated by the selected Building's own real
//     buildingType — enabled only when RESIDENTIAL, disabled + relabeled
//     "Flat (not applicable)" for COMMERCIAL (same dynamic relabel
//     pattern as City/Area/Site/Floor/Wing/Flat Master's own rebuilds
//     this session, here gated on Building Type rather than a country
//     capability flag). Both COMMERCIAL and RESIDENTIAL buildings are
//     offered in the Building dropdown itself — this task's own explicit
//     "Support both actual COMMERCIAL and RESIDENTIAL Building Types",
//     unlike Flat Master's own RESIDENTIAL-only Building restriction.
//   - Building/Floor/Wing/Flat are each disabled until their own parent
//     is chosen, then client-side filtered to that parent's own children
//     — none of BuildingGetRequest/FloorGetRequest/WingGetRequest/
//     FlatGetRequest forces a server-side filtered call for this flow, so
//     each level is a client-side filter over one real fetch each,
//     narrowed by the selected parent's own real id (already denormalized
//     onto each child row).
//   - Room Code: CONFIRMED LIVE genuinely auto-generated SERVER-SIDE — a
//     real master/room/add call that omitted roomCode entirely returned a
//     real generated value in the response AND on refetch (see
//     room.model.ts's own comment). The field here is therefore always
//     read-only: never sent on Add (left null so the backend generates
//     it), and echoed back unchanged — never regenerated — on Edit.
//   - Site change clears Building, Floor, Wing AND Flat; Building change
//     clears Floor, Wing AND Flat (which also re-evaluates Flat's own
//     applicability for the newly selected Building's type); Floor change
//     clears Wing AND Flat; Wing change clears Flat only (this task's own
//     "Dependency Reset Rules").
//   - Room Number: CONFIRMED LIVE a plain nullable STRING on the real
//     RoomSaveRequest — never coerced through a number input or parsed to
//     a number (same leading-zero-preservation concern as Flat Number
//     this session).
//   - Edit mode uses a distinct "Update Room" submit button label (same
//     explicit per-task pattern as every other location Master's own
//     "Update X" this session).
@Component({
  selector: 'app-room-form-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, ButtonComponent, InputComponent, TextareaComponent, ComboboxComponent],
  templateUrl: './room-form-dialog.component.html',
  styleUrl: './room-form-dialog.component.scss',
})
export class RoomFormDialogComponent implements OnInit {
  private readonly masterApi = inject(MasterApiService);
  private readonly dialogService = inject(DialogService);
  protected readonly dialogRef = inject(DialogRef<RoomFormDialogResult>);

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
  protected readonly flatsLoading = signal(true);
  protected readonly flatsError = signal(false);

  // The row's own saved Site/Building/Floor/Wing/Flat are preserved as
  // selectable even if no longer eligible by the time this dialog opens
  // for Edit — same "preserve existing relationships" pattern as every
  // other location Master's own rebuild this session.
  private savedSiteOption: SiteRow | null = null;
  private savedBuildingOption: BuildingRow | null = null;
  private savedFloorOption: FloorRow | null = null;
  private savedWingOption: WingRow | null = null;
  private savedFlatOption: FlatRow | null = null;
  private readonly eligibleSites = signal<SiteRow[]>([]);
  private readonly allBuildings = signal<BuildingRow[]>([]);
  private readonly allFloors = signal<FloorRow[]>([]);
  private readonly allWings = signal<WingRow[]>([]);
  private readonly allFlats = signal<FlatRow[]>([]);

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
  // The FULL selected Building row (not just its id) — its own real
  // buildingType drives Flat applicability below, same pattern as
  // selectedCountry in Area/City/Site/Floor/Wing/Flat Master's own
  // rebuilds this session.
  protected readonly selectedBuilding = signal<BuildingRow | null>(null);
  protected readonly selectedFloorId = signal<string>('');
  protected readonly selectedWingId = signal<string>('');

  protected readonly flatApplicable = computed(() => this.selectedBuilding()?.buildingType === 'RESIDENTIAL');
  protected readonly flatLabel = computed(() => (this.selectedBuilding() && !this.flatApplicable() ? 'Flat (not applicable)' : 'Flat'));

  // Dynamic footer guidance — this task's own explicit Section 2 example
  // ("Select Building."), extended across the whole chain the same way
  // Wing Master's own rebuild this session did.
  protected readonly helperText = computed(() => {
    if (!this.selectedSiteId()) return 'Select Site.';
    if (!this.selectedBuilding()) return 'Select Building.';
    if (!this.selectedFloorId()) return 'Select Floor.';
    if (!this.selectedWingId()) return 'Select Wing.';
    return this.flatApplicable() ? 'Flat is optional. Enter Room Name to continue.' : 'Flat is not applicable for Commercial buildings. Enter Room Name to continue.';
  });

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
    const building = this.selectedBuilding();
    if (!building) return [];
    const filtered = this.allFloors().filter((f) => f.buildingId === building.buildingId && f.isActive);
    const options = filtered.map((f) => this.toFloorOption(f));
    if (this.savedFloorOption && this.savedFloorOption.buildingId === building.buildingId && !filtered.some((f) => f.floorId === this.savedFloorOption!.floorId)) {
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

  protected readonly flatOptions = computed<SelectOption[]>(() => {
    const wingId = this.selectedWingId();
    if (!wingId || !this.flatApplicable()) return [];
    const filtered = this.allFlats().filter((f) => f.wingId === wingId && f.isActive);
    const options = filtered.map((f) => this.toFlatOption(f));
    if (this.savedFlatOption && this.savedFlatOption.wingId === wingId && !filtered.some((f) => f.flatId === this.savedFlatOption!.flatId)) {
      options.unshift(this.toFlatOption(this.savedFlatOption));
    }
    return options;
  });

  constructor(@Inject(DIALOG_DATA) public data: RoomFormDialogData) {
    this.isEdit = data.mode === 'edit';
    const row = data.row;

    this.form = new FormGroup({
      roomId: new FormControl(row?.roomId ?? null),
      siteId: new FormControl(row?.siteId ?? '', [Validators.required]),
      buildingId: new FormControl(row?.buildingId ?? '', [Validators.required]),
      floorId: new FormControl(row?.floorId ?? '', [Validators.required]),
      wingId: new FormControl(row?.wingId ?? '', [Validators.required]),
      flatId: new FormControl(row?.flatId ?? ''),
      // Always read-only — "Room Code must be generated by the backend...
      // Do not allow users to manually edit an automatically generated
      // Room Code" (this task's own Section 2). Disabled from
      // construction in BOTH modes, never re-enabled.
      roomCode: new FormControl({ value: row?.roomCode ?? '', disabled: true }),
      // Plain text, never number — see this file's own class-level
      // comment (preserves formatting exactly as typed/saved).
      roomNumber: new FormControl(row?.roomNumber ?? '', [Validators.maxLength(50)]),
      roomName: new FormControl(row?.roomName ?? '', [Validators.required, Validators.maxLength(200)]),
      // Always blank, including on Edit — same confirmed-live
      // write-only-per-action changelog behavior as every other location
      // Master's own remarks fields this session.
      remarks: new FormControl(''),
    });

    // All four dependent levels start disabled — "Building dropdown:
    // Initially disabled until Site is selected" / "Floor dropdown:
    // Initially disabled until Building is selected" / "Wing dropdown:
    // Initially disabled until Floor is selected" / Flat likewise
    // disabled until a Wing is chosen AND the Building is RESIDENTIAL
    // (this task's own Section 3).
    this.form.get('buildingId')!.disable({ emitEvent: false });
    this.form.get('floorId')!.disable({ emitEvent: false });
    this.form.get('wingId')!.disable({ emitEvent: false });
    this.form.get('flatId')!.disable({ emitEvent: false });

    // Registered AFTER the initial values above, so restoring a saved
    // row's own siteId/buildingId/floorId/wingId on Edit does not
    // immediately clear its own already-correct dependents — only a
    // genuine, later user-driven change should do that.
    this.form.get('siteId')!.valueChanges.subscribe((siteId: string) => {
      this.applySelectedSite(siteId, true);
    });
    this.form.get('buildingId')!.valueChanges.subscribe((buildingId: string) => {
      this.applySelectedBuilding(buildingId, true);
    });
    this.form.get('floorId')!.valueChanges.subscribe((floorId: string) => {
      this.applySelectedFloor(floorId, true);
    });
    this.form.get('wingId')!.valueChanges.subscribe((wingId: string) => {
      this.applySelectedWing(wingId, true);
    });
  }

  ngOnInit(): void {
    this.loadSites();
    this.loadBuildings();
    this.loadFloors();
    this.loadWings();
    this.loadFlats();
  }

  private toSiteOption(s: SiteRow): SelectOption {
    return { label: s.siteCode ? `${s.siteName} (${s.siteCode})` : (s.siteName ?? ''), value: s.siteId };
  }

  private toBuildingOption(b: BuildingRow): SelectOption {
    const base = b.buildingCode ? `${b.buildingName} (${b.buildingCode})` : (b.buildingName ?? '');
    return { label: b.buildingType ? `${base} — ${b.buildingType}` : base, value: b.buildingId };
  }

  private toFloorOption(f: FloorRow): SelectOption {
    return { label: f.floorCode ? `${f.floorName} (${f.floorCode})` : (f.floorName ?? ''), value: f.floorId };
  }

  private toWingOption(w: WingRow): SelectOption {
    return { label: w.wingCode ? `${w.wingName} (${w.wingCode})` : (w.wingName ?? ''), value: w.wingId };
  }

  private toFlatOption(f: FlatRow): SelectOption {
    return { label: f.flatCode ? `${f.flatName} (${f.flatCode})` : (f.flatName ?? ''), value: f.flatId };
  }

  private applySelectedSite(siteId: string, resetDependents: boolean): void {
    this.selectedSiteId.set(siteId);

    // Synchronous, not an effect() reacting to a computed signal later —
    // a form control's own enabled state should change in lockstep with
    // the action that caused it (see city-form-dialog.component.ts's own
    // comment this session for the async-effect() timing bug this
    // avoids).
    this.syncControlEnabled(this.form.get('buildingId')!, !!siteId);

    if (resetDependents) {
      // Site changed — clear Building, Floor, Wing AND Flat (this task's
      // own "Dependency Reset Rules": "Site changes -> clear Building,
      // Floor, Wing and Flat").
      this.form.get('buildingId')!.setValue('', { emitEvent: false });
      this.selectedBuilding.set(null);
      this.form.get('floorId')!.setValue('', { emitEvent: false });
      this.selectedFloorId.set('');
      this.syncControlEnabled(this.form.get('floorId')!, false);
      this.form.get('wingId')!.setValue('', { emitEvent: false });
      this.selectedWingId.set('');
      this.syncControlEnabled(this.form.get('wingId')!, false);
      this.form.get('flatId')!.setValue('', { emitEvent: false });
      this.syncControlEnabled(this.form.get('flatId')!, false);
    }
  }

  private applySelectedBuilding(buildingId: string, resetDependents: boolean): void {
    const building = this.allBuildings().find((b) => b.buildingId === buildingId) ?? (this.savedBuildingOption?.buildingId === buildingId ? this.savedBuildingOption : null);
    this.selectedBuilding.set(building);

    this.syncControlEnabled(this.form.get('floorId')!, !!buildingId);

    if (resetDependents) {
      // Building changed — clear Floor, Wing AND Flat (this task's own
      // "Dependency Reset Rules": "Building changes -> clear Floor, Wing
      // and Flat"); also re-evaluates Flat's own applicability for the
      // newly selected Building's type below.
      this.form.get('floorId')!.setValue('', { emitEvent: false });
      this.selectedFloorId.set('');
      this.form.get('wingId')!.setValue('', { emitEvent: false });
      this.selectedWingId.set('');
      this.syncControlEnabled(this.form.get('wingId')!, false);
      this.form.get('flatId')!.setValue('', { emitEvent: false });
    }
    this.syncFlatEnabled();
  }

  private applySelectedFloor(floorId: string, resetDependents: boolean): void {
    this.selectedFloorId.set(floorId);

    this.syncControlEnabled(this.form.get('wingId')!, !!floorId);

    if (resetDependents) {
      // Floor changed — clear Wing AND Flat (this task's own "Dependency
      // Reset Rules": "Floor changes -> clear Wing and Flat").
      this.form.get('wingId')!.setValue('', { emitEvent: false });
      this.selectedWingId.set('');
      this.form.get('flatId')!.setValue('', { emitEvent: false });
    }
    this.syncFlatEnabled();
  }

  private applySelectedWing(wingId: string, resetFlat: boolean): void {
    this.selectedWingId.set(wingId);

    if (resetFlat) {
      // Wing changed — clear Flat only (this task's own "Dependency Reset
      // Rules": "Wing changes -> clear Flat").
      this.form.get('flatId')!.setValue('', { emitEvent: false });
    }
    this.syncFlatEnabled();
  }

  private syncFlatEnabled(): void {
    this.syncControlEnabled(this.form.get('flatId')!, !!this.selectedWingId() && this.flatApplicable());
  }

  private syncControlEnabled(control: AbstractControl, shouldBeEnabled: boolean): void {
    if (shouldBeEnabled) {
      if (control.disabled) control.enable({ emitEvent: false });
    } else if (control.enabled) {
      control.disable({ emitEvent: false });
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
        const currentWingId = this.form.get('wingId')!.value;
        if (currentWingId) this.applySelectedWing(currentWingId, false);
      },
      error: () => {
        this.wingsLoading.set(false);
        this.wingsError.set(true);
      },
    });
  }

  private loadFlats(): void {
    this.flatsLoading.set(true);
    this.flatsError.set(false);
    this.masterApi.get<Record<string, unknown>, FlatRow>('master/flat', { searchText: null, isActive: null }).subscribe({
      next: (flats) => {
        this.flatsLoading.set(false);
        this.allFlats.set(flats);
        const savedId = this.data.row?.flatId;
        if (savedId) this.savedFlatOption = flats.find((f) => f.flatId === savedId) ?? null;
      },
      error: () => {
        this.flatsLoading.set(false);
        this.flatsError.set(true);
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
    const payload: RoomSaveRequest = {
      roomId: this.isEdit ? value.roomId : null,
      siteId: value.siteId,
      buildingId: value.buildingId,
      floorId: value.floorId,
      wingId: value.wingId,
      // Never a fabricated Flat ID — read directly from the control's own
      // real disabled state, not a re-derived business rule.
      flatId: this.form.get('flatId')!.disabled ? null : value.flatId || null,
      // Never sent on Add (the backend generates it); echoed back
      // unchanged — never regenerated — on Edit (this file's own
      // class-level comment).
      roomCode: this.isEdit ? (this.data.row?.roomCode ?? null) : null,
      // Trim leading/trailing spaces — this task's own Section 6/8.
      roomNumber: (value.roomNumber || '').trim() || null,
      roomName: (value.roomName || '').trim(),
      remarks: value.remarks || null,
    };

    const request$ = this.isEdit ? this.masterApi.edit('master/room', payload) : this.masterApi.add('master/room', payload);
    request$.subscribe({
      next: (res) => {
        this.saving.set(false);
        if (res.success) {
          this.dialogRef.close(true);
        } else {
          this.errorMessage.set(usableMessage(res.message) ?? 'Failed to save this room.');
        }
      },
      error: (err) => {
        this.saving.set(false);
        this.errorMessage.set(extractApiErrorMessage(err) ?? 'Something went wrong while saving this room.');
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
            message: 'Your changes to this room have not been saved.',
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
