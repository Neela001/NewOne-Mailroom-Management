import { Component, Inject, OnInit, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { DIALOG_DATA } from '../../../shared/ui/dialog/dialog-data.token';
import { DialogRef } from '../../../shared/ui/dialog/dialog-ref';
import { DialogService } from '../../../shared/ui/dialog/dialog.service';
import { ConfirmDialogComponent } from '../../master/shared/confirm-dialog.component';
import { ApiService } from '../../../core/services/api.service';
import { normalizeRowKeys } from '../../master/shared/pascal-case.util';
import {
  CourierVendorContactDraft,
  CourierVendorDeskAssignmentRow,
  CourierVendorDeskOptionRow,
  CourierVendorOptionsResponse,
  CourierVendorRow,
  CourierVendorSaveRequest,
} from './couriervendor.model';
import { extractApiErrorMessage, usableMessage } from '../../../core/utils/api-error.util';
import { handleFormEnterKey } from '../../../core/utils/form-keyboard.util';
import { ButtonComponent } from '../../../shared/ui/button/button.component';
import { InputComponent } from '../../../shared/ui/form/input.component';
import { TextareaComponent } from '../../../shared/ui/form/textarea.component';
import { ComboboxComponent } from '../../../shared/ui/form/combobox.component';
import { SelectComponent, SelectOption } from '../../../shared/ui/form/select.component';
import { IconComponent } from '../../../shared/ui/icon/icon.component';

export interface CourierVendorFormDialogData {
  row: CourierVendorRow | null; // null for 'add', present for 'edit'
  mode: 'add' | 'edit';
}

export type CourierVendorFormDialogResult = boolean;

type TabKey = 'details' | 'desks' | 'contacts';

// Confirmed-live real values only — no backend enum/options source exists
// for either field; see couriervendor.model.ts's own comment.
const VENDOR_TYPE_OPTIONS: SelectOption[] = [
  { label: 'Both', value: 'BOTH' },
  { label: 'Inbound Only', value: 'INBOUND_ONLY' },
];
const SERVICE_TYPE_OPTIONS: SelectOption[] = [
  { label: 'Domestic', value: 'DOMESTIC' },
  { label: 'Both', value: 'BOTH' },
];

interface ContactDisplayRow extends CourierVendorContactDraft {
  deskCode?: string | null;
  deskName?: string | null;
}

// Add/Edit Courier Vendor — not MasterFormDialogComponent-driven. A
// genuine 3-tab workflow (Vendor Details, Desks, Contacts) built on a
// dedicated combined-save API family with no shape in the generic
// formFields model. See couriervendor.model.ts's own class-level comment
// for the full confirmed-live API writeup this dialog implements exactly:
//   - master/couriervendor/options/get {} is the real source for both
//     the Courier Mode dropdown and the Desks tab's own available-desk
//     list (one call, both lists) — filtered to active-only client-side.
//   - Always saves through master/couriervendor/save-with-contacts
//     (never the plain add/edit), sending the complete current desk id
//     set (deskIds) plus the current contacts array and an explicit
//     deletedContactIds list for any previously-saved contact the user
//     removed this session — a genuine diff model for contacts, NOT the
//     full-replace semantics every other combined-save entity this
//     session used for its own sub-array.
//   - Every Contact requires a Desk (CONFIRMED LIVE — see the model's own
//     comment) scoped to THIS vendor's own currently-assigned desks, not
//     a system-wide desk list. Removing a Desk that has Contacts tied to
//     it also removes those Contacts (this dialog's own explicit rule,
//     not covered by the task's own brief, added so no Contact can ever
//     reference a Desk the vendor no longer has — flagged in the final
//     report).
@Component({
  selector: 'app-couriervendor-form-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, FormsModule, ButtonComponent, InputComponent, TextareaComponent, ComboboxComponent, SelectComponent, IconComponent],
  templateUrl: './couriervendor-form-dialog.component.html',
  styleUrl: './couriervendor-form-dialog.component.scss',
})
export class CourierVendorFormDialogComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly dialogService = inject(DialogService);
  protected readonly dialogRef = inject(DialogRef<CourierVendorFormDialogResult>);

  protected readonly isEdit: boolean;
  private readonly currentVendorId: string | null;
  protected readonly saving = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly form: FormGroup;
  protected readonly activeTab = signal<TabKey>('details');
  protected readonly vendorTypeOptions = VENDOR_TYPE_OPTIONS;
  protected readonly serviceTypeOptions = SERVICE_TYPE_OPTIONS;

  protected readonly optionsLoading = signal(true);
  protected readonly optionsError = signal(false);
  private readonly modes = signal<CourierVendorOptionsResponse['modes']>([]);
  private readonly deskOptionsRaw = signal<CourierVendorDeskOptionRow[]>([]);

  protected readonly modeOptions = computed<SelectOption[]>(() => {
    const rows = this.modes().filter((m) => m.isActive);
    const saved = this.data.row?.courierModeId;
    if (saved && !rows.some((m) => m.courierModeId === saved)) {
      const savedRow = this.modes().find((m) => m.courierModeId === saved);
      if (savedRow) rows.unshift(savedRow);
    }
    return rows.map((m) => ({ label: m.modeCode ? `${m.modeName} (${m.modeCode})` : (m.modeName ?? ''), value: m.courierModeId }));
  });

  // --- Desks tab ---
  protected readonly assignedDesks = signal<CourierVendorDeskAssignmentRow[]>([]);
  protected readonly selectedAvailableDeskId = signal<string | null>(null);
  protected readonly selectedAssignedDeskId = signal<string | null>(null);

  protected readonly availableDeskRows = computed(() => {
    const assignedIds = new Set(this.assignedDesks().map((d) => d.deskId));
    return this.deskOptionsRaw().filter((d) => d.isActive && !assignedIds.has(d.deskId));
  });

  // --- Contacts tab ---
  protected readonly contacts = signal<ContactDisplayRow[]>([]);
  protected readonly selectedContactIndex = signal<number | null>(null);
  protected readonly newContactDeskId = signal<string>('');
  protected readonly newContactPerson = signal<string>('');
  protected readonly newContactNo = signal<string>('');
  protected readonly newContactEmail = signal<string>('');
  private readonly deletedContactIds = signal<string[]>([]);

  protected readonly contactDeskOptions = computed<SelectOption[]>(() =>
    this.assignedDesks().map((d) => ({ label: d.deskCode ? `${d.deskName} (${d.deskCode})` : (d.deskName ?? ''), value: d.deskId })),
  );

  protected readonly helperText = computed(() => (this.form.get('courierModeId')!.value ? 'Ready' : 'Select Courier Mode, then enter the Vendor details.'));

  private initialDeskIdsSnapshot = '';
  private initialContactsSnapshot = '';
  protected readonly hasUnsavedChanges = computed(() => {
    const deskDirty = JSON.stringify(this.assignedDesks().map((d) => d.deskId).sort()) !== this.initialDeskIdsSnapshot;
    const contactsDirty =
      JSON.stringify(
        this.contacts()
          .map((c) => `${c.courierVendorContactId ?? 'new'}|${c.deskId}|${c.contactPerson ?? ''}|${c.contactNo ?? ''}|${c.emailId ?? ''}`)
          .sort(),
      ) !== this.initialContactsSnapshot || this.deletedContactIds().length > 0;
    return this.form.dirty || deskDirty || contactsDirty;
  });

  constructor(@Inject(DIALOG_DATA) public data: CourierVendorFormDialogData) {
    this.isEdit = data.mode === 'edit';
    const row = data.row;
    this.currentVendorId = row?.courierVendorId ?? null;

    this.form = new FormGroup({
      courierVendorId: new FormControl(row?.courierVendorId ?? null),
      courierModeId: new FormControl(row?.courierModeId ?? '', [Validators.required]),
      vendorType: new FormControl(row?.vendorType ?? '', [Validators.required]),
      vendorCode: new FormControl(row?.vendorCode ?? '', [Validators.required, Validators.maxLength(50)]),
      vendorName: new FormControl(row?.vendorName ?? '', [Validators.required, Validators.maxLength(200)]),
      trackingUrl: new FormControl(row?.trackingUrl ?? ''),
      serviceType: new FormControl(row?.serviceType ?? '', [Validators.required]),
      // Always blank, including on Edit — same confirmed-live
      // write-only-per-action changelog behavior as every other Master's
      // own remarks fields this session.
      remarks: new FormControl(''),
    });
  }

  ngOnInit(): void {
    this.loadOptions();
    if (this.isEdit && this.currentVendorId) {
      this.loadDesks(this.currentVendorId);
      this.loadContacts(this.currentVendorId);
    } else {
      this.initialDeskIdsSnapshot = JSON.stringify([]);
      this.initialContactsSnapshot = JSON.stringify([]);
    }
  }

  // Reload data — re-fetches the Courier Mode / available-Desk option
  // lists only, without touching Vendor Details, assigned Desks or
  // Contacts (same "must not unexpectedly erase unsaved assignments"
  // rule as Employee Master's own Reload data button this session).
  protected reloadData(): void {
    this.loadOptions();
  }

  private loadOptions(): void {
    this.optionsLoading.set(true);
    this.optionsError.set(false);
    this.api.post<Record<string, never>, CourierVendorOptionsResponse>('master/couriervendor/options/get', {}).subscribe({
      next: (res) => {
        this.optionsLoading.set(false);
        if (res.success && res.data) {
          const raw = res.data as unknown as { modes: Record<string, unknown>[]; desks: Record<string, unknown>[] };
          this.modes.set((raw.modes ?? []).map((m) => normalizeRowKeys(m)) as unknown as CourierVendorOptionsResponse['modes']);
          this.deskOptionsRaw.set((raw.desks ?? []).map((d) => normalizeRowKeys(d)) as unknown as CourierVendorDeskOptionRow[]);
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

  private loadDesks(courierVendorId: string): void {
    this.api.post<{ courierVendorId: string }, Record<string, unknown>[]>('master/couriervendor/desk/get', { courierVendorId }).subscribe({
      next: (res) => {
        const rows = (res.data ?? []).map((r) => normalizeRowKeys(r) as unknown as CourierVendorDeskAssignmentRow & { isActive?: boolean }).filter((r) => r.isActive !== false);
        this.assignedDesks.set(rows);
        this.initialDeskIdsSnapshot = JSON.stringify(rows.map((d) => d.deskId).sort());
      },
      error: () => this.errorMessage.set("Couldn't load this vendor's existing desk assignments."),
    });
  }

  private loadContacts(courierVendorId: string): void {
    this.api.post<{ courierVendorId: string; searchText: null; isActive: null }, Record<string, unknown>[]>('master/couriervendor/contact/get', { courierVendorId, searchText: null, isActive: null }).subscribe({
      next: (res) => {
        const rows = (res.data ?? [])
          .map((r) => normalizeRowKeys(r) as unknown as { courierVendorContactId: string; deskId: string; deskCode?: string | null; deskName?: string | null; contactPerson?: string | null; contactNo?: string | null; emailId?: string | null; isActive?: boolean })
          .filter((r) => r.isActive !== false)
          .map((r): ContactDisplayRow => ({ courierVendorContactId: r.courierVendorContactId, deskId: r.deskId, deskCode: r.deskCode, deskName: r.deskName, contactPerson: r.contactPerson, contactNo: r.contactNo, emailId: r.emailId }));
        this.contacts.set(rows);
        this.initialContactsSnapshot = JSON.stringify(rows.map((c) => `${c.courierVendorContactId ?? 'new'}|${c.deskId}|${c.contactPerson ?? ''}|${c.contactNo ?? ''}|${c.emailId ?? ''}`).sort());
      },
      error: () => this.errorMessage.set("Couldn't load this vendor's existing contacts."),
    });
  }

  // --- Desks tab ---
  protected selectAvailableDesk(row: CourierVendorDeskOptionRow): void {
    this.selectedAvailableDeskId.set(row.deskId);
  }

  protected isAvailableDeskSelected(row: CourierVendorDeskOptionRow): boolean {
    return this.selectedAvailableDeskId() === row.deskId;
  }

  protected addDesk(row?: CourierVendorDeskOptionRow): void {
    const target = row ?? this.availableDeskRows().find((r) => this.isAvailableDeskSelected(r));
    if (!target) return;
    if (this.assignedDesks().some((d) => d.deskId === target.deskId)) return; // duplicate guard
    this.assignedDesks.update((list) => [
      ...list,
      {
        courierVendorDeskId: '',
        courierVendorId: this.currentVendorId ?? '',
        deskId: target.deskId,
        deskCode: target.deskCode,
        deskName: target.deskName,
        siteName: target.siteName,
        cityName: target.cityName,
        isActive: true,
      },
    ]);
    this.selectedAvailableDeskId.set(null);
  }

  protected selectAssignedDesk(row: CourierVendorDeskAssignmentRow): void {
    this.selectedAssignedDeskId.set(row.deskId);
  }

  protected isAssignedDeskSelected(row: CourierVendorDeskAssignmentRow): boolean {
    return this.selectedAssignedDeskId() === row.deskId;
  }

  protected removeDesk(): void {
    const deskId = this.selectedAssignedDeskId();
    if (!deskId) return;
    this.assignedDesks.update((list) => list.filter((d) => d.deskId !== deskId));
    this.selectedAssignedDeskId.set(null);

    // A Contact can never outlive the Desk it belongs to — see this
    // file's own class comment for why this rule exists.
    const orphaned = this.contacts().filter((c) => c.deskId === deskId);
    if (orphaned.length > 0) {
      for (const c of orphaned) {
        if (c.courierVendorContactId) this.deletedContactIds.update((ids) => [...ids, c.courierVendorContactId!]);
      }
      this.contacts.update((list) => list.filter((c) => c.deskId !== deskId));
    }
  }

  // --- Contacts tab ---
  protected addContact(): void {
    const deskId = this.newContactDeskId();
    if (!deskId) return;
    const person = this.newContactPerson().trim();
    const phone = this.newContactNo().trim();
    const email = this.newContactEmail().trim();
    if (!person && !phone && !email) return;
    const desk = this.assignedDesks().find((d) => d.deskId === deskId);
    this.contacts.update((list) => [
      ...list,
      { courierVendorContactId: null, deskId, deskCode: desk?.deskCode, deskName: desk?.deskName, contactPerson: person || null, contactNo: phone || null, emailId: email || null },
    ]);
    this.newContactDeskId.set('');
    this.newContactPerson.set('');
    this.newContactNo.set('');
    this.newContactEmail.set('');
  }

  protected selectContact(index: number): void {
    this.selectedContactIndex.set(this.selectedContactIndex() === index ? null : index);
  }

  protected removeContact(): void {
    const index = this.selectedContactIndex();
    if (index === null) return;
    const target = this.contacts()[index];
    if (!target) return;
    if (target.courierVendorContactId) {
      this.deletedContactIds.update((ids) => [...ids, target.courierVendorContactId!]);
    }
    this.contacts.update((list) => list.filter((_, i) => i !== index));
    this.selectedContactIndex.set(null);
  }

  // --- Tabs ---
  protected setTab(tab: TabKey): void {
    this.activeTab.set(tab);
  }

  onEnterKey(event: Event): void {
    handleFormEnterKey(event as KeyboardEvent);
  }

  onCancel(): void {
    this.dialogRef.close(false);
  }

  protected onCancelClick(): void {
    if (this.hasUnsavedChanges()) {
      this.dialogService
        .open(ConfirmDialogComponent, {
          width: '420px',
          data: {
            title: 'Discard unsaved changes?',
            message: 'Your changes to this courier vendor — including any Desk or Contact changes — have not been saved.',
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
      this.activeTab.set('details');
      return;
    }
    if (this.saving()) return;

    this.saving.set(true);
    this.errorMessage.set(null);

    const value = this.form.getRawValue();
    const payload: CourierVendorSaveRequest = {
      vendor: {
        courierVendorId: this.isEdit ? value.courierVendorId : null,
        courierModeId: value.courierModeId,
        vendorCode: (value.vendorCode || '').trim(),
        vendorName: (value.vendorName || '').trim(),
        vendorType: value.vendorType || null,
        serviceType: value.serviceType || null,
        trackingUrl: (value.trackingUrl || '').trim() || null,
        remarks: value.remarks || null,
      },
      deskIds: this.assignedDesks().map((d) => d.deskId),
      contacts: this.contacts().map((c) => ({
        courierVendorContactId: c.courierVendorContactId ?? null,
        deskId: c.deskId,
        contactPerson: c.contactPerson || null,
        contactNo: c.contactNo || null,
        emailId: c.emailId || null,
      })),
      deletedContactIds: this.deletedContactIds(),
    };

    this.api.post<CourierVendorSaveRequest, { Status: number; Message: string; CourierVendorId: string }[]>('master/couriervendor/save-with-contacts', payload).subscribe({
      next: (res) => {
        this.saving.set(false);
        if (res.success) {
          this.dialogRef.close(true);
        } else {
          this.errorMessage.set(usableMessage(res.message) ?? 'Failed to save this courier vendor.');
        }
      },
      error: (err) => {
        this.saving.set(false);
        this.errorMessage.set(extractApiErrorMessage(err) ?? 'Something went wrong while saving this courier vendor.');
      },
    });
  }
}
