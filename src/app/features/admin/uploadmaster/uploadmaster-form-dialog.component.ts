import { Component, Inject, OnInit, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { DIALOG_DATA } from '../../../shared/ui/dialog/dialog-data.token';
import { DialogRef } from '../../../shared/ui/dialog/dialog-ref';
import { DialogService } from '../../../shared/ui/dialog/dialog.service';
import { ConfirmDialogComponent } from '../../master/shared/confirm-dialog.component';
import { UploadMasterService } from './uploadmaster.service';
import { UploadDefinitionRow, UploadProcedureOption } from './uploadmaster.model';
import { extractApiErrorMessage, usableMessage } from '../../../core/utils/api-error.util';
import { handleFormEnterKey } from '../../../core/utils/form-keyboard.util';
import { ButtonComponent } from '../../../shared/ui/button/button.component';
import { InputComponent } from '../../../shared/ui/form/input.component';
import { SelectComponent, SelectOption } from '../../../shared/ui/form/select.component';
import { ComboboxComponent } from '../../../shared/ui/form/combobox.component';
import { CheckboxComponent } from '../../../shared/ui/form/checkbox.component';
import { TextareaComponent } from '../../../shared/ui/form/textarea.component';

export interface UploadMasterFormDialogData {
  row: UploadDefinitionRow | null; // null for 'add', present for 'edit'
  mode: 'add' | 'edit';
}

export type UploadMasterFormDialogResult = boolean;

type Tab = 'basic' | 'xml';

const NOT_APPLICABLE: SelectOption = { label: '(Not applicable)', value: '' };
const NONE: SelectOption = { label: '(None)', value: '' };

// Valid XML element-name shape (starts with a letter/underscore, then
// letters/digits/underscore/hyphen/period, no spaces) — xmlRootName/
// xmlRowName become literal XML element names in the real payload the
// backend's own stored procedure parses, so this is a real constraint,
// not an invented one.
const XML_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_.-]*$/;

// Upload Master's own Add/Edit dialog — not MasterFormDialogComponent-
// driven. See uploadmaster.model.ts's own comment for the real
// admin/upload-master/procedures/get endpoint this "Procedure Dependency
// Logic" is built against: it returns an already backend-pre-filtered,
// already-paired list of {procedureSchema, procedureName,
// xmlParameterName, contextParameterName} — there is no further per-
// procedure "parameter discovery" step to perform client-side. XML
// parameter / Context parameter / Context type are therefore auto-
// populated AND LOCKED the instant a Procedure is selected (never an
// independently-editable dropdown with multiple real choices for a given
// procedure) — this is what makes an incompatible combination structurally
// impossible to submit, rather than merely validated after the fact.
//
// Context Type has no backing list anywhere in the API (procedures/get
// carries no contextType field at all, and neither real existing
// definition has ever used a non-null one) — the ONLY grounded value this
// codebase has evidence for is "Guid", taken directly from this task's own
// reference copy ("an optional GUID context") and the one real procedure
// that has a non-null contextParameterName. It is therefore auto-set
// to "Guid" when a context parameter exists and left blank otherwise,
// never offered as a free, multi-option dropdown — doing that would be
// inventing backend functionality this app has no evidence for.
@Component({
  selector: 'app-uploadmaster-form-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, ButtonComponent, InputComponent, SelectComponent, ComboboxComponent, CheckboxComponent, TextareaComponent],
  templateUrl: './uploadmaster-form-dialog.component.html',
  styleUrl: './uploadmaster-form-dialog.component.scss',
})
export class UploadMasterFormDialogComponent implements OnInit {
  private readonly uploadMasterService = inject(UploadMasterService);
  private readonly dialogService = inject(DialogService);
  protected readonly dialogRef = inject(DialogRef<UploadMasterFormDialogResult>);

  protected readonly isEdit: boolean;
  protected readonly dialogTitle: string;
  protected readonly saving = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly tab = signal<Tab>('basic');

  protected readonly procedures = signal<UploadProcedureOption[]>([]);
  protected readonly proceduresLoading = signal(true);
  protected readonly proceduresError = signal(false);
  protected readonly procedureOptions = computed<SelectOption[]>(() => this.procedures().map((p) => ({ label: p.procedureName, value: this.procedureKey(p) })));

  // The one saved combination being edited doesn't disappear from the
  // dropdown even if a later Reload no longer returns it from the real,
  // currently-compatible procedure list — "Preserve existing XML layout
  // during Edit" takes priority over hiding a now-stale-but-still-saved
  // choice.
  private savedProcedureOption: UploadProcedureOption | null = null;

  protected readonly selectedProcedure = signal<UploadProcedureOption | null>(null);
  protected readonly xmlParameterOptions = computed<SelectOption[]>(() => {
    const proc = this.selectedProcedure();
    return proc ? [{ label: proc.xmlParameterName, value: proc.xmlParameterName }] : [];
  });
  protected readonly contextParameterOptions = computed<SelectOption[]>(() => {
    const proc = this.selectedProcedure();
    return proc?.contextParameterName ? [NONE, { label: proc.contextParameterName, value: proc.contextParameterName }] : [NONE];
  });
  protected readonly contextTypeOptions = computed<SelectOption[]>(() => {
    const proc = this.selectedProcedure();
    return proc?.contextParameterName ? [{ label: 'Guid', value: 'Guid' }] : [NOT_APPLICABLE];
  });

  protected readonly form: FormGroup;

  constructor(@Inject(DIALOG_DATA) public data: UploadMasterFormDialogData) {
    this.isEdit = data.mode === 'edit';
    this.dialogTitle = this.isEdit ? 'Edit Upload Definition' : 'Add Upload Definition';
    const row = data.row;

    this.form = new FormGroup({
      uploadDefinitionId: new FormControl(row?.uploadDefinitionId ?? null),
      uploadName: new FormControl(row?.uploadName ?? '', [Validators.required, Validators.maxLength(200)]),
      procedureKey: new FormControl('', [Validators.required]),
      xmlParameterName: new FormControl(row?.xmlParameterName ?? ''),
      contextParameterName: new FormControl(row?.contextParameterName ?? ''),
      contextType: new FormControl(row?.contextType ?? ''),
      isRetrySafe: new FormControl(row?.isRetrySafe ?? true),
      // CONFIRMED LIVE (2026-11-12): "Change remarks" is a genuine, real,
      // write-only-per-action changelog note — NOT persistent row state.
      // A real add() call with remarks:"Probe remarks value" returns
      // success, but the row it creates has no Remarks key at all in the
      // real admin/upload-master/get response (confirmed by enumerating
      // the real response's own keys); that SAME text instead shows up
      // correctly on the matching CREATE row of admin/upload-master/
      // history/get. So this field is always blank on open (row?.remarks
      // is never actually present) — always starting empty here is
      // correct, not a bug, and matches the task's own "(optional)"
      // phrasing: a note for THIS save, not a field being edited.
      remarks: new FormControl(row?.remarks ?? '', [Validators.maxLength(500)]),
      xmlRootName: new FormControl(row?.xmlRootName ?? '', [Validators.required, Validators.pattern(XML_NAME_PATTERN)]),
      xmlRowName: new FormControl(row?.xmlRowName ?? '', [Validators.required, Validators.pattern(XML_NAME_PATTERN)]),
      columnsCsv: new FormControl(row?.columnsCsv ?? '', [Validators.required]),
    });

    // Auto-populated and never independently user-editable — see this
    // component's own class-level comment for why.
    this.form.get('xmlParameterName')!.disable({ emitEvent: false });
    this.form.get('contextParameterName')!.disable({ emitEvent: false });
    this.form.get('contextType')!.disable({ emitEvent: false });

    if (row?.procedureSchema && row?.procedureName) {
      this.savedProcedureOption = {
        procedureSchema: row.procedureSchema,
        procedureName: row.procedureName,
        xmlParameterName: row.xmlParameterName ?? '',
        contextParameterName: row.contextParameterName ?? null,
      };
      this.form.get('procedureKey')!.setValue(this.procedureKey(this.savedProcedureOption), { emitEvent: false });
      this.selectedProcedure.set(this.savedProcedureOption);
    }

    this.form.get('procedureKey')!.valueChanges.subscribe((key: string) => {
      const proc = this.procedures().find((p) => this.procedureKey(p) === key) ?? (this.savedProcedureOption && this.procedureKey(this.savedProcedureOption) === key ? this.savedProcedureOption : null);
      this.selectedProcedure.set(proc);
      // Auto-populate + lock, per this component's own class-level comment
      // — cleared entirely when the procedure is cleared/changed to one
      // without a context parameter.
      this.form.get('xmlParameterName')!.setValue(proc?.xmlParameterName ?? '', { emitEvent: false });
      this.form.get('contextParameterName')!.setValue(proc?.contextParameterName ?? '', { emitEvent: false });
      this.form.get('contextType')!.setValue(proc?.contextParameterName ? 'Guid' : '', { emitEvent: false });
    });
  }

  ngOnInit(): void {
    this.loadProcedures();
  }

  protected procedureKey(p: UploadProcedureOption): string {
    return `${p.procedureSchema}|${p.procedureName}`;
  }

  protected loadProcedures(): void {
    this.proceduresLoading.set(true);
    this.proceduresError.set(false);
    this.uploadMasterService.procedures().subscribe({
      next: (rows) => {
        this.procedures.set(rows);
        this.proceduresLoading.set(false);
        // Re-resolve the current selection against the freshly reloaded
        // list so xmlParameterOptions/contextParameterOptions stay in
        // sync with whatever is now selected.
        const key = this.form.get('procedureKey')!.value;
        if (key) {
          const proc = rows.find((p) => this.procedureKey(p) === key) ?? (this.savedProcedureOption && this.procedureKey(this.savedProcedureOption) === key ? this.savedProcedureOption : null);
          this.selectedProcedure.set(proc);
        }
      },
      error: () => {
        this.proceduresLoading.set(false);
        this.proceduresError.set(true);
      },
    });
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
      // Surface whichever tab actually has the problem rather than leaving
      // the user staring at a tab with no visible error.
      this.tab.set(this.form.get('uploadName')?.invalid || this.form.get('procedureKey')?.invalid ? 'basic' : 'xml');
      return;
    }
    if (this.saving()) return;

    this.saving.set(true);
    this.errorMessage.set(null);

    const value = this.form.getRawValue();
    const proc = this.selectedProcedure();
    const payload = {
      uploadDefinitionId: this.isEdit ? value.uploadDefinitionId : null,
      uploadName: value.uploadName,
      procedureSchema: proc?.procedureSchema ?? null,
      procedureName: proc?.procedureName ?? null,
      xmlParameterName: value.xmlParameterName || null,
      contextParameterName: value.contextParameterName || null,
      contextType: value.contextType || null,
      xmlRootName: value.xmlRootName,
      xmlRowName: value.xmlRowName,
      columnsCsv: value.columnsCsv,
      isRetrySafe: !!value.isRetrySafe,
      remarks: value.remarks || null,
    };

    const request$ = this.isEdit ? this.uploadMasterService.edit(payload) : this.uploadMasterService.add(payload);
    request$.subscribe({
      next: (res) => {
        this.saving.set(false);
        if (res.success) {
          this.dialogRef.close(true);
        } else {
          this.errorMessage.set(usableMessage(res.message) ?? 'Failed to save this upload definition.');
        }
      },
      error: (err) => {
        this.saving.set(false);
        this.errorMessage.set(extractApiErrorMessage(err) ?? 'Something went wrong while saving this upload definition.');
      },
    });
  }

  // Cancel should warn about unsaved changes — this dialog's own form
  // starts untouched (Add) or matching the saved row exactly (Edit), so
  // `form.dirty` reliably reflects real unsaved work either way (columnsCsv
  // is now a plain tracked FormControl like every other field, not
  // separate component state).
  protected onCancelClick(): void {
    if (this.form.dirty) {
      this.dialogService
        .open(ConfirmDialogComponent, {
          width: '420px',
          data: {
            title: 'Discard unsaved changes?',
            message: 'Your changes to this upload definition have not been saved.',
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
