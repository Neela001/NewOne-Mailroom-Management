import { Component, Inject, OnInit, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { DIALOG_DATA } from '../../../shared/ui/dialog/dialog-data.token';
import { DialogRef } from '../../../shared/ui/dialog/dialog-ref';
import { DialogService } from '../../../shared/ui/dialog/dialog.service';
import { ConfirmDialogComponent } from '../shared/confirm-dialog.component';
import { MasterApiService } from '../shared/master-api.service';
import { BUILDING_TYPE_OPTIONS, BuildingRow, BuildingSaveRequest } from './building.model';
import { SiteRow } from '../site/site.model';
import { extractApiErrorMessage, usableMessage } from '../../../core/utils/api-error.util';
import { handleFormEnterKey } from '../../../core/utils/form-keyboard.util';
import { ButtonComponent } from '../../../shared/ui/button/button.component';
import { InputComponent } from '../../../shared/ui/form/input.component';
import { TextareaComponent } from '../../../shared/ui/form/textarea.component';
import { ComboboxComponent } from '../../../shared/ui/form/combobox.component';
import { SelectComponent, SelectOption } from '../../../shared/ui/form/select.component';

export interface BuildingFormDialogData {
  row: BuildingRow | null; // null for 'add', present for 'edit'
  mode: 'add' | 'edit';
}

export type BuildingFormDialogResult = boolean;

// Add/Edit Building — not MasterFormDialogComponent-driven. See
// building-list.component.ts's own comment for why. This dialog's own
// reasons for being dedicated:
//   - Site dropdown: real master/site/get rows filtered to isActive only
//     (this task's own "Follow actual backend rules for active/inactive
//     Site eligibility"), full-width, combined "Name (Code)" labels —
//     same pattern as every other location-dropdown Master's own rebuild
//     this session.
//   - Building Type: Swagger's own schema shows buildingType as a plain
//     unconstrained string (no enum, no lookup/master entity anywhere in
//     the API). But CONFIRMED LIVE the real backend DOES enforce a
//     constraint Swagger never exposed — a real master/building/add call
//     with an arbitrary value returned `{ success: false, message:
//     "Invalid Building Type. Allowed values are COMMERCIAL and
//     RESIDENTIAL." }`. BUILDING_TYPE_OPTIONS (building.model.ts) is
//     sourced directly from that real error message, not hardcoded from
//     assumption — see this module's own final report for the full
//     writeup of this Swagger-vs-actual-behavior gap.
//   - Edit mode uses a distinct "Update Building" submit button label
//     (this task's own explicit instruction), unlike every other entity
//     this session which reuses the same "Save X" label for both modes.
@Component({
  selector: 'app-building-form-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, ButtonComponent, InputComponent, TextareaComponent, ComboboxComponent, SelectComponent],
  templateUrl: './building-form-dialog.component.html',
  styleUrl: './building-form-dialog.component.scss',
})
export class BuildingFormDialogComponent implements OnInit {
  private readonly masterApi = inject(MasterApiService);
  private readonly dialogService = inject(DialogService);
  protected readonly dialogRef = inject(DialogRef<BuildingFormDialogResult>);

  protected readonly isEdit: boolean;
  protected readonly saving = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly form: FormGroup;

  protected readonly sitesLoading = signal(true);
  protected readonly sitesError = signal(false);
  protected readonly buildingTypeOptions: SelectOption[] = BUILDING_TYPE_OPTIONS.map((t) => ({ label: t, value: t }));

  // The row's own saved Site is preserved as selectable even if no longer
  // eligible (e.g. deactivated) by the time this dialog opens for Edit —
  // same "preserve existing relationships" pattern as every other
  // location-dropdown Master's own rebuild this session.
  private savedSiteOption: SiteRow | null = null;
  private readonly eligibleSites = signal<SiteRow[]>([]);

  protected readonly siteOptions = computed<SelectOption[]>(() => {
    const options = this.eligibleSites().map((s) => this.toSiteOption(s));
    if (this.savedSiteOption && !this.eligibleSites().some((s) => s.siteId === this.savedSiteOption!.siteId)) {
      options.unshift(this.toSiteOption(this.savedSiteOption));
    }
    return options;
  });

  constructor(@Inject(DIALOG_DATA) public data: BuildingFormDialogData) {
    this.isEdit = data.mode === 'edit';
    const row = data.row;

    this.form = new FormGroup({
      buildingId: new FormControl(row?.buildingId ?? null),
      siteId: new FormControl(row?.siteId ?? '', [Validators.required]),
      buildingCode: new FormControl(row?.buildingCode ?? '', [Validators.required, Validators.maxLength(50)]),
      buildingName: new FormControl(row?.buildingName ?? '', [Validators.required, Validators.maxLength(200)]),
      buildingType: new FormControl(row?.buildingType ?? '', [Validators.required, Validators.maxLength(100)]),
      // Always blank, including on Edit — same confirmed-live
      // write-only-per-action changelog behavior as Country/State/City/
      // Postal Code/Area/Site/Upload Master's own remarks fields this
      // session.
      remarks: new FormControl(''),
    });
  }

  ngOnInit(): void {
    this.loadSites();
  }

  private toSiteOption(s: SiteRow): SelectOption {
    return { label: s.siteCode ? `${s.siteName} (${s.siteCode})` : (s.siteName ?? ''), value: s.siteId };
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
    if (this.saving()) return;

    this.saving.set(true);
    this.errorMessage.set(null);

    const value = this.form.getRawValue();
    const payload: BuildingSaveRequest = {
      buildingId: this.isEdit ? value.buildingId : null,
      siteId: value.siteId,
      // Trim leading/trailing spaces — this task's own Section 6.
      buildingCode: (value.buildingCode || '').trim() || null,
      buildingName: (value.buildingName || '').trim(),
      buildingType: (value.buildingType || '').trim(),
      remarks: value.remarks || null,
    };

    const request$ = this.isEdit ? this.masterApi.edit('master/building', payload) : this.masterApi.add('master/building', payload);
    request$.subscribe({
      next: (res) => {
        this.saving.set(false);
        if (res.success) {
          this.dialogRef.close(true);
        } else {
          this.errorMessage.set(usableMessage(res.message) ?? 'Failed to save this building.');
        }
      },
      error: (err) => {
        this.saving.set(false);
        this.errorMessage.set(extractApiErrorMessage(err) ?? 'Something went wrong while saving this building.');
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
            message: 'Your changes to this building have not been saved.',
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
