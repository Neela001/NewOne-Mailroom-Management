import { Component, Inject, OnInit, computed, inject, signal } from '@angular/core';
import { AbstractControl, FormControl, FormGroup, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { DIALOG_DATA } from '../../../shared/ui/dialog/dialog-data.token';
import { DialogRef } from '../../../shared/ui/dialog/dialog-ref';
import { DialogService } from '../../../shared/ui/dialog/dialog.service';
import { ConfirmDialogComponent } from '../../master/shared/confirm-dialog.component';
import { ApiService } from '../../../core/services/api.service';
import { MasterApiService } from '../../master/shared/master-api.service';
import { normalizeRowKeys } from '../../master/shared/pascal-case.util';
import { CourierProductOptionsResponse, CourierProductRow, CourierProductSaveRequest, CourierProductVendorOptionItem } from './courierproduct.model';
import { extractApiErrorMessage, usableMessage } from '../../../core/utils/api-error.util';
import { handleFormEnterKey } from '../../../core/utils/form-keyboard.util';
import { ButtonComponent } from '../../../shared/ui/button/button.component';
import { InputComponent } from '../../../shared/ui/form/input.component';
import { TextareaComponent } from '../../../shared/ui/form/textarea.component';
import { ComboboxComponent } from '../../../shared/ui/form/combobox.component';
import { SelectComponent, SelectOption } from '../../../shared/ui/form/select.component';

export interface CourierProductFormDialogData {
  row: CourierProductRow | null; // null for 'add', present for 'edit'
  mode: 'add' | 'edit';
}

export type CourierProductFormDialogResult = boolean;

// Confirmed-live real values only — no fixed enum/options source exists
// independent of a Vendor; see courierproduct.model.ts's own comment.
const SERVICE_TYPE_LABELS: Record<string, string> = { DOMESTIC: 'Domestic', BOTH: 'Both' };

// CONFIRMED LIVE real backend rule ("Volumetric divisor must be a whole
// number from 0 to 99999999999999.") — see courierproduct.model.ts's own
// class comment for the full confirmed-live writeup, including why this
// deliberately does NOT reject zero (real data uses it) and DOES reject
// any decimal value (both a 1-decimal and a 4-decimal probe were
// rejected with this exact message).
function volumetricDivisorValidator(control: AbstractControl): ValidationErrors | null {
  const raw = control.value;
  if (raw === '' || raw === null || raw === undefined) return null; // required handled separately
  const num = Number(raw);
  if (Number.isNaN(num) || !Number.isInteger(num) || num < 0 || num > 99999999999999) {
    return { volumetricDivisor: true };
  }
  return null;
}

// Add/Edit Courier Product — not MasterFormDialogComponent-driven. A
// genuine Mode -> Vendor -> Service Type dependency chain with no shape
// in the generic formFields model. See courierproduct.model.ts's own
// class-level comment for the full confirmed-live API writeup this
// dialog implements exactly:
//   - master/courierproduct/options/get {} is the real source for Mode,
//     Product Group and Vendor option lists (one call, all three) —
//     filtered to active-only client-side.
//   - Vendor options are filtered to the selected Mode's own id
//     (vendor.courierModeId === selected courierModeId) — confirmed no
//     server-side filter param exists for this, same established
//     client-filter pattern as every cascading dropdown this session.
//   - Service Type is NOT an independently browsable option list — it is
//     derived directly from the selected Vendor's own real serviceType
//     value (confirmed live: every one of 7 real existing products has a
//     serviceType exactly equal to its own vendor's serviceType). The
//     dropdown enables once a Vendor with a real serviceType is selected
//     and is auto-populated with that single confirmed value.
//   - Volumetric Divisor must be a non-negative WHOLE number up to
//     99999999999999 (CONFIRMED LIVE exact real validation message) —
//     zero is valid (real data uses it), decimals are rejected.
@Component({
  selector: 'app-courierproduct-form-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, ButtonComponent, InputComponent, TextareaComponent, ComboboxComponent, SelectComponent],
  templateUrl: './courierproduct-form-dialog.component.html',
  styleUrl: './courierproduct-form-dialog.component.scss',
})
export class CourierProductFormDialogComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly masterApi = inject(MasterApiService);
  private readonly dialogService = inject(DialogService);
  protected readonly dialogRef = inject(DialogRef<CourierProductFormDialogResult>);

  protected readonly isEdit: boolean;
  protected readonly saving = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly form: FormGroup;

  protected readonly optionsLoading = signal(true);
  protected readonly optionsError = signal(false);
  private readonly modes = signal<CourierProductOptionsResponse['modes']>([]);
  private readonly productGroups = signal<CourierProductOptionsResponse['productGroups']>([]);
  private readonly vendors = signal<CourierProductVendorOptionItem[]>([]);

  private readonly originalModeId: string | null;
  // True only once the constructor's own initial control-value syncs have
  // run — see this file's own valueChanges subscriptions for why this
  // replaces a fragile `.dirty`/"previous was non-empty" guard.
  private hasInitialized = false;
  protected readonly selectedModeId = signal<string>('');
  protected readonly selectedVendorId = signal<string>('');

  protected readonly modeOptions = computed<SelectOption[]>(() => {
    const rows = this.modes().filter((m) => m.isActive);
    const saved = this.data.row?.courierModeId;
    if (saved && !rows.some((m) => m.id === saved)) {
      const savedRow = this.modes().find((m) => m.id === saved);
      if (savedRow) rows.unshift(savedRow);
    }
    return rows.map((m) => ({ label: m.code ? `${m.name} (${m.code})` : (m.name ?? ''), value: m.id }));
  });

  protected readonly productGroupOptions = computed<SelectOption[]>(() => {
    const rows = this.productGroups().filter((g) => g.isActive);
    const saved = this.data.row?.courierProductGroupId;
    if (saved && !rows.some((g) => g.id === saved)) {
      const savedRow = this.productGroups().find((g) => g.id === saved);
      if (savedRow) rows.unshift(savedRow);
    }
    return rows.map((g) => ({ label: g.code ? `${g.name} (${g.code})` : (g.name ?? ''), value: g.id }));
  });

  // Vendor options scoped to the selected Mode — same "preserve saved
  // option when still in the original Mode" pattern as every other
  // cascading dialog this session.
  protected readonly vendorOptions = computed<SelectOption[]>(() => {
    const modeId = this.selectedModeId();
    const rows = this.vendors().filter((v) => v.isActive && v.courierModeId === modeId);
    const saved = this.data.row?.courierVendorId;
    if (saved && this.selectedModeId() === (this.originalModeId ?? '') && !rows.some((v) => v.id === saved)) {
      const savedRow = this.vendors().find((v) => v.id === saved);
      if (savedRow) rows.unshift(savedRow);
    }
    return rows.map((v) => ({ label: v.code ? `${v.name} (${v.code})` : (v.name ?? ''), value: v.id }));
  });

  // Service Type: derived from the selected Vendor's own real
  // serviceType — not independently browsable. Falls back to the saved
  // value too, so Edit never silently loses an existing relationship even
  // if the vendor's own serviceType has since changed.
  protected readonly serviceTypeOptions = computed<SelectOption[]>(() => {
    const vendorId = this.selectedVendorId();
    const vendor = this.vendors().find((v) => v.id === vendorId);
    const values = new Set<string>();
    if (vendor?.serviceType) values.add(vendor.serviceType);
    const saved = this.data.row?.serviceType;
    if (saved) values.add(saved);
    return Array.from(values).map((v) => ({ label: SERVICE_TYPE_LABELS[v] ?? v, value: v }));
  });

  protected readonly helperText = computed(() => (this.selectedVendorId() ? 'Ready' : 'Select Courier Mode and Vendor to load the supported Service Type.'));

  constructor(@Inject(DIALOG_DATA) public data: CourierProductFormDialogData) {
    this.isEdit = data.mode === 'edit';
    const row = data.row;
    this.originalModeId = row?.courierModeId ?? null;

    this.form = new FormGroup({
      courierProductId: new FormControl(row?.courierProductId ?? null),
      code: new FormControl(row?.code ?? '', [Validators.required, Validators.maxLength(50)]),
      name: new FormControl(row?.name ?? '', [Validators.required, Validators.maxLength(200)]),
      courierModeId: new FormControl(row?.courierModeId ?? '', [Validators.required]),
      courierVendorId: new FormControl({ value: row?.courierVendorId ?? '', disabled: !row?.courierModeId }, [Validators.required]),
      courierProductGroupId: new FormControl(row?.courierProductGroupId ?? '', [Validators.required]),
      serviceType: new FormControl({ value: row?.serviceType ?? '', disabled: !row?.courierVendorId }, [Validators.required]),
      volumetricDivisor: new FormControl(row?.volumetricDivisor != null ? String(row.volumetricDivisor) : '', [Validators.required, volumetricDivisorValidator]),
      // Always blank, including on Edit — same confirmed-live
      // write-only-per-action changelog behavior as every other Master's
      // own remarks fields this session.
      remarks: new FormControl(''),
    });

    this.form.get('courierModeId')!.valueChanges.subscribe((modeId: string) => {
      this.selectedModeId.set(modeId);
      this.syncControlEnabled(this.form.get('courierVendorId')!, !!modeId);
      // Reset the dependent Vendor on any REAL change (including the
      // very first one the user makes) — gated on hasInitialized, not on
      // `.dirty` or "previous value was non-empty": setValue()/patchValue()
      // never mark a control dirty (only genuine UI interaction does), so
      // a dirty-based guard would silently skip this reset/auto-populate
      // on the very first selection — caught by this dialog's own unit
      // tests exercising that exact first-selection path.
      if (this.hasInitialized) {
        this.form.get('courierVendorId')!.setValue('', { emitEvent: true });
      }
    });
    this.selectedModeId.set(this.form.get('courierModeId')!.value);

    this.form.get('courierVendorId')!.valueChanges.subscribe((vendorId: string) => {
      this.selectedVendorId.set(vendorId);
      this.syncControlEnabled(this.form.get('serviceType')!, !!vendorId);
      if (this.hasInitialized) {
        const vendor = this.vendors().find((v) => v.id === vendorId);
        this.form.get('serviceType')!.setValue(vendor?.serviceType ?? '', { emitEvent: false });
      }
    });
    this.selectedVendorId.set(this.form.get('courierVendorId')!.value);

    this.hasInitialized = true;
  }

  ngOnInit(): void {
    this.loadOptions();
  }

  private syncControlEnabled(control: AbstractControl, shouldBeEnabled: boolean): void {
    if (shouldBeEnabled) {
      if (control.disabled) control.enable({ emitEvent: false });
    } else if (control.enabled) {
      control.disable({ emitEvent: false });
    }
  }

  protected reloadData(): void {
    this.loadOptions();
  }

  private loadOptions(): void {
    this.optionsLoading.set(true);
    this.optionsError.set(false);
    this.api.post<Record<string, never>, CourierProductOptionsResponse>('master/courierproduct/options/get', {}).subscribe({
      next: (res) => {
        this.optionsLoading.set(false);
        if (res.success && res.data) {
          const raw = res.data as unknown as { modes: Record<string, unknown>[]; productGroups: Record<string, unknown>[]; vendors: Record<string, unknown>[] };
          this.modes.set((raw.modes ?? []).map((m) => normalizeRowKeys(m)) as unknown as CourierProductOptionsResponse['modes']);
          this.productGroups.set((raw.productGroups ?? []).map((g) => normalizeRowKeys(g)) as unknown as CourierProductOptionsResponse['productGroups']);
          this.vendors.set((raw.vendors ?? []).map((v) => normalizeRowKeys(v)) as unknown as CourierProductVendorOptionItem[]);
          // Once vendors load, re-sync the Service Type auto-population
          // for an already-selected vendor (Edit mode's own initial load
          // races this fetch).
          const vendorId = this.form.get('courierVendorId')!.value;
          if (vendorId && !this.data.row?.serviceType) {
            const vendor = this.vendors().find((v) => v.id === vendorId);
            if (vendor?.serviceType) this.form.get('serviceType')!.setValue(vendor.serviceType, { emitEvent: false });
          }
        } else {
          this.optionsError.set(true);
        }
      },
      error: () => {
        this.optionsLoading.set(false);
        this.optionsError.set(true);
      },
    });
  }

  onEnterKey(event: Event): void {
    handleFormEnterKey(event as KeyboardEvent);
  }

  onCancel(): void {
    this.dialogRef.close(false);
  }

  protected onCancelClick(): void {
    if (this.form.dirty) {
      this.dialogService
        .open(ConfirmDialogComponent, {
          width: '420px',
          data: {
            title: 'Discard unsaved changes?',
            message: 'Your changes to this courier product have not been saved.',
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

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    if (this.saving()) return;

    this.saving.set(true);
    this.errorMessage.set(null);

    const value = this.form.getRawValue();
    const payload: CourierProductSaveRequest = {
      courierProductId: this.isEdit ? value.courierProductId : null,
      code: (value.code || '').trim(),
      name: (value.name || '').trim(),
      courierModeId: value.courierModeId,
      courierVendorId: value.courierVendorId,
      courierProductGroupId: value.courierProductGroupId,
      serviceType: value.serviceType || null,
      volumetricDivisor: value.volumetricDivisor === '' ? null : Number(value.volumetricDivisor),
      remarks: value.remarks || null,
    };

    const request$ = this.isEdit ? this.masterApi.edit('master/courierproduct', payload) : this.masterApi.add('master/courierproduct', payload);

    request$.subscribe({
      next: (res) => {
        this.saving.set(false);
        if (res.success) {
          this.dialogRef.close(true);
        } else {
          // Surfaces the REAL backend message verbatim, e.g. "Volumetric
          // divisor must be a whole number from 0 to 99999999999999." or
          // "Duplicate product code already exists." (this file's own
          // class comment).
          this.errorMessage.set(usableMessage(res.message) ?? 'Failed to save this courier product.');
        }
      },
      error: (err) => {
        this.saving.set(false);
        this.errorMessage.set(extractApiErrorMessage(err) ?? 'Something went wrong while saving this courier product.');
      },
    });
  }
}
