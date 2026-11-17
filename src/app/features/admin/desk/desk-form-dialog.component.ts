import { Component, Inject, OnInit, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { DIALOG_DATA } from '../../../shared/ui/dialog/dialog-data.token';
import { DialogRef } from '../../../shared/ui/dialog/dialog-ref';
import { DialogService } from '../../../shared/ui/dialog/dialog.service';
import { MasterApiService } from '../../master/shared/master-api.service';
import { DeskService } from './desk.service';
import { DeskLocationOption, DeskRow, DeskType } from './desk.model';
import { extractApiErrorMessage, usableMessage } from '../../../core/utils/api-error.util';
import { handleFormEnterKey } from '../../../core/utils/form-keyboard.util';
import { ButtonComponent } from '../../../shared/ui/button/button.component';
import { InputComponent } from '../../../shared/ui/form/input.component';
import { SelectComponent, SelectOption } from '../../../shared/ui/form/select.component';
import { ComboboxComponent } from '../../../shared/ui/form/combobox.component';
import { CheckboxComponent } from '../../../shared/ui/form/checkbox.component';
import { TextareaComponent } from '../../../shared/ui/form/textarea.component';
import { RichTextEditorComponent } from '../../../shared/ui/form/rich-text-editor.component';

export interface DeskFormDialogData {
  row: DeskRow | null; // null for 'add', present for 'edit'
  mode: 'add' | 'edit';
}

export type DeskFormDialogResult = boolean;

type Tab = 'details' | 'email';

interface RawSite {
  siteId: string;
  siteName: string;
  cityId: string;
}

const DESK_TYPE_OPTIONS: SelectOption[] = [
  { label: 'MAIN', value: 'MAIN' },
  { label: 'SUB', value: 'SUB' },
];

// Desk's own Add/Edit dialog (not the generic MasterFormDialogComponent —
// see desk.model.ts's own comment for why Desk is a dedicated feature:
// one combined save-with-locations endpoint, a 2-tab UI, and a
// site-dependent Building/Floor/Wing location table the generic
// formFields model has no shape for).
//
// Building/Floor/Wing deliberately does NOT load when this dialog opens —
// only once a real Site is selected (master/desk/location-options/get
// requires siteId) — see onSiteChanged()'s own comment for the full
// load/clear/restore workflow this implements.
@Component({
  selector: 'app-desk-form-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, FormsModule, ButtonComponent, InputComponent, SelectComponent, ComboboxComponent, CheckboxComponent, TextareaComponent, RichTextEditorComponent],
  templateUrl: './desk-form-dialog.component.html',
  styleUrl: './desk-form-dialog.component.scss',
})
export class DeskFormDialogComponent implements OnInit {
  private readonly masterApi = inject(MasterApiService);
  private readonly deskService = inject(DeskService);
  private readonly dialogService = inject(DialogService);
  protected readonly dialogRef = inject(DialogRef<DeskFormDialogResult>);

  protected readonly isEdit: boolean;
  protected readonly dialogTitle: string;
  protected readonly saving = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly tab = signal<Tab>('details');
  protected readonly deskTypeOptions = DESK_TYPE_OPTIONS;

  protected readonly cityOptions = signal<SelectOption[]>([]);
  protected readonly cityLoading = signal(true);
  protected readonly cityError = signal(false);

  // The raw site list (with each site's own real cityId) is kept
  // separately from the Combobox-ready {label, value}[] shown in the
  // template — Site has no server-side cityId filter (confirmed: real
  // SiteGetRequest schema documents only {siteId, searchText, isActive}),
  // so the City -> Site relationship is applied client-side the same way
  // every other master entity's own un-cascadable dropdown already is.
  private readonly allSites = signal<RawSite[]>([]);
  protected readonly siteLoading = signal(true);
  protected readonly siteError = signal(false);
  protected readonly selectedCityId = signal('');
  protected readonly siteOptions = computed<SelectOption[]>(() => {
    const cityId = this.selectedCityId();
    return this.allSites()
      .filter((s) => !cityId || s.cityId === cityId)
      .map((s) => ({ label: s.siteName, value: s.siteId }));
  });

  protected readonly deskType = signal<DeskType>('MAIN');
  protected readonly parentDeskOptions = signal<SelectOption[]>([]);
  protected readonly parentDeskLoading = signal(false);
  protected readonly parentDeskError = signal(false);

  protected readonly emailOptions = signal<SelectOption[]>([]);
  protected readonly emailLoading = signal(true);
  protected readonly emailError = signal(false);

  // Location Selection — see onSiteChanged()'s own comment for the full
  // load/clear/restore/stale-response workflow.
  protected readonly locationOptions = signal<DeskLocationOption[]>([]);
  protected readonly locationsLoading = signal(false);
  protected readonly locationsError = signal(false);
  protected readonly selectedLocationKeys = signal<Set<string>>(new Set());
  protected readonly selectedLocationCount = computed(() => this.selectedLocationKeys().size);
  private requestToken = 0;

  protected readonly form: FormGroup;

  constructor(@Inject(DIALOG_DATA) public data: DeskFormDialogData) {
    this.isEdit = data.mode === 'edit';
    this.dialogTitle = this.isEdit ? 'Edit Desk' : 'Add Desk';
    const row = data.row;

    this.form = new FormGroup({
      deskId: new FormControl(row?.deskId ?? null),
      deskType: new FormControl<DeskType>(row?.deskType ?? 'MAIN', [Validators.required]),
      parentDeskId: new FormControl(row?.parentDeskId ?? ''),
      deskCode: new FormControl(row?.deskCode ?? '', [Validators.required, Validators.maxLength(30)]),
      deskName: new FormControl(row?.deskName ?? '', [Validators.required, Validators.maxLength(150)]),
      cityId: new FormControl(row?.cityId ?? '', [Validators.required]),
      siteId: new FormControl(row?.siteId ?? '', [Validators.required]),
      emailId: new FormControl(row?.emailId ?? ''),
      emailSignature: new FormControl(row?.emailSignature ?? ''),
      remarks: new FormControl('', [Validators.maxLength(500)]),
    });

    this.deskType.set(this.form.get('deskType')!.value);
    this.selectedCityId.set(this.form.get('cityId')!.value || '');

    this.form.get('deskType')!.valueChanges.subscribe((type: DeskType) => {
      this.deskType.set(type);
      if (type === 'MAIN') {
        // Not relevant for a MAIN desk — clear it rather than silently
        // submitting a stale parent from before the user switched type.
        this.form.get('parentDeskId')!.setValue('', { emitEvent: false });
      }
    });

    this.form.get('cityId')!.valueChanges.subscribe((cityId: string) => {
      this.selectedCityId.set(cityId || '');
      const currentSiteId = this.form.get('siteId')!.value;
      const stillValid = this.siteOptions().some((o) => o.value === currentSiteId);
      if (!stillValid) {
        this.form.get('siteId')!.setValue(''); // triggers siteId's own valueChanges below
      }
    });

    this.form.get('siteId')!.valueChanges.subscribe((siteId: string) => {
      this.onSiteChanged(siteId || '');
    });
  }

  ngOnInit(): void {
    this.masterApi.get<Record<string, unknown>, Record<string, unknown>>('master/city', { searchText: null, isActive: true }).subscribe({
      next: (rows) => {
        this.cityOptions.set(rows.map((r) => ({ label: String(r['cityName'] ?? ''), value: String(r['cityId']) })));
        this.cityLoading.set(false);
      },
      error: () => {
        this.cityLoading.set(false);
        this.cityError.set(true);
      },
    });

    this.masterApi.get<Record<string, unknown>, Record<string, unknown>>('master/site', { searchText: null, isActive: true }).subscribe({
      next: (rows) => {
        this.allSites.set(rows.map((r) => ({ siteId: String(r['siteId']), siteName: String(r['siteName'] ?? ''), cityId: String(r['cityId'] ?? '') })));
        this.siteLoading.set(false);
      },
      error: () => {
        this.siteLoading.set(false);
        this.siteError.set(true);
      },
    });

    this.loadParentDeskOptions();
    this.loadEmailOptions();

    // Edit: restore the saved Site's own location table (and its
    // already-checked rows) up front — this doesn't violate "don't load
    // until a Site is selected" (that rule governs the ADD flow, where no
    // Site is selected yet); Edit always starts from an already-saved,
    // already-selected Site.
    if (this.isEdit && this.data.row?.siteId) {
      this.onSiteChanged(this.data.row.siteId);
    }
  }

  private loadParentDeskOptions(): void {
    this.parentDeskLoading.set(true);
    this.parentDeskError.set(false);
    this.deskService.get({ deskType: 'MAIN', isActive: true }).subscribe({
      next: (rows) => {
        const options = rows
          .filter((r) => !this.data.row || r.deskId !== this.data.row.deskId) // a desk can't be its own parent
          .map((r) => ({ label: `${r.deskCode ?? ''} - ${r.deskName ?? ''}`, value: r.deskId }));
        this.parentDeskOptions.set(options);
        this.parentDeskLoading.set(false);
      },
      error: () => {
        this.parentDeskLoading.set(false);
        this.parentDeskError.set(true);
      },
    });
  }

  protected loadEmailOptions(): void {
    this.emailLoading.set(true);
    this.emailError.set(false);
    this.masterApi.get<Record<string, unknown>, Record<string, unknown>>('master/email-setting', { searchText: null, isActive: true }).subscribe({
      next: (rows) => {
        this.emailOptions.set(
          rows.map((r) => {
            const name = String(r['emailName'] ?? '');
            const address = String(r['emailAddress'] ?? '');
            return { label: name && name !== address ? `${name} (${address})` : address || name, value: address || name };
          }),
        );
        this.emailLoading.set(false);
      },
      error: () => {
        this.emailLoading.set(false);
        this.emailError.set(true);
      },
    });
  }

  // Opens the full Email Settings management window on top of this
  // dialog (not a navigation away from Add/Edit Desk — EmailSettingListComponent
  // is dual-use: see its own dialogRef comment) so the user can add/edit a
  // mailbox without losing their in-progress desk form, then reloads this
  // dialog's own Email dropdown in case anything changed.
  protected openEmailSettings(): void {
    import('../emailsetting/emailsetting-list.component').then(({ EmailSettingListComponent }) => {
      this.dialogService
        .open(EmailSettingListComponent, {
          width: '96vw',
          maxWidth: '1800px',
          height: '90vh',
          panelClass: 'app-dialog-panel--fill',
        })
        .afterClosed()
        .subscribe(() => this.loadEmailOptions());
    });
  }

  private static locationKey(opt: { buildingId: string; floorId: string; wingId: string }): string {
    return `${opt.buildingId}|${opt.floorId}|${opt.wingId}`;
  }

  // The one site-dependent load this whole dialog revolves around: fires
  // on every siteId change (the user picking a Site for the first time,
  // switching to a different Site, or this component's own Edit-mode
  // restore above) — always clears whatever was shown before, so a stale
  // previous Site's rows are never left on screen, then fetches the new
  // Site's real Building/Floor/Wing catalog. Passing this desk's own
  // deskId (Edit only) is what makes the response come back with
  // isChecked=true for the combinations already assigned to it — see
  // desk.model.ts's own DeskLocationOption comment.
  private onSiteChanged(siteId: string): void {
    this.locationOptions.set([]);
    this.selectedLocationKeys.set(new Set());
    this.locationsError.set(false);

    if (!siteId) {
      this.locationsLoading.set(false);
      return;
    }

    this.locationsLoading.set(true);
    const token = ++this.requestToken;
    const deskId = this.isEdit ? (this.data.row?.deskId ?? null) : null;

    this.deskService.locationOptions({ siteId, deskId }).subscribe({
      next: (rows) => {
        if (token !== this.requestToken) return; // a newer site change already superseded this response
        this.locationsLoading.set(false);
        this.locationOptions.set(rows);
        this.selectedLocationKeys.set(new Set(rows.filter((r) => r.isChecked).map((r) => DeskFormDialogComponent.locationKey(r))));
      },
      error: () => {
        if (token !== this.requestToken) return;
        this.locationsLoading.set(false);
        this.locationsError.set(true);
      },
    });
  }

  protected isLocationSelected(opt: DeskLocationOption): boolean {
    return this.selectedLocationKeys().has(DeskFormDialogComponent.locationKey(opt));
  }

  protected toggleLocation(opt: DeskLocationOption): void {
    if (!opt.isAvailable) return;
    const key = DeskFormDialogComponent.locationKey(opt);
    const next = new Set(this.selectedLocationKeys());
    if (next.has(key)) next.delete(key);
    else next.add(key);
    this.selectedLocationKeys.set(next);
  }

  setTab(tab: Tab): void {
    this.tab.set(tab);
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
      this.tab.set('details');
      return;
    }
    if (this.selectedLocationCount() === 0) {
      this.errorMessage.set('Select at least one Building / Floor / Wing location for this desk.');
      this.tab.set('details');
      return;
    }
    if (this.saving()) return;

    this.saving.set(true);
    this.errorMessage.set(null);

    const value = this.form.getRawValue();
    const locations = [...this.selectedLocationKeys()].map((key) => {
      const [buildingId, floorId, wingId] = key.split('|');
      return { buildingId, floorId, wingId };
    });

    this.deskService
      .save({
        deskId: this.isEdit ? value.deskId : null,
        deskType: value.deskType,
        parentDeskId: value.deskType === 'SUB' && value.parentDeskId ? value.parentDeskId : null,
        deskCode: value.deskCode,
        deskName: value.deskName,
        cityId: value.cityId,
        siteId: value.siteId,
        emailId: value.emailId || null,
        emailSignature: value.emailSignature || null,
        remarks: value.remarks || null,
        locations,
      })
      .subscribe({
        next: (res) => {
          this.saving.set(false);
          if (res.success) {
            this.dialogRef.close(true);
          } else {
            this.errorMessage.set(usableMessage(res.message) ?? 'Failed to save this desk.');
          }
        },
        error: (err) => {
          this.saving.set(false);
          this.errorMessage.set(extractApiErrorMessage(err) ?? 'Something went wrong while saving this desk.');
        },
      });
  }
}
