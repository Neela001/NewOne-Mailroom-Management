import { Component, Inject, OnInit, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { combineLatest } from 'rxjs';
import { startWith } from 'rxjs/operators';
import { DIALOG_DATA } from '../../../shared/ui/dialog/dialog-data.token';
import { DialogRef } from '../../../shared/ui/dialog/dialog-ref';
import { MasterApiService } from './master-api.service';
import { MasterEntityConfig, MasterFormField } from './master-entity-config.model';
import { handleFormEnterKey } from '../../../core/utils/form-keyboard.util';
import { ButtonComponent } from '../../../shared/ui/button/button.component';
import { InputComponent } from '../../../shared/ui/form/input.component';
import { SelectComponent, SelectOption } from '../../../shared/ui/form/select.component';
import { ComboboxComponent } from '../../../shared/ui/form/combobox.component';
import { CheckboxComponent } from '../../../shared/ui/form/checkbox.component';
import { TextareaComponent } from '../../../shared/ui/form/textarea.component';

export interface MasterFormDialogData {
  config: MasterEntityConfig;
  row: Record<string, unknown> | null; // null for 'add', present for 'edit'
  mode: 'add' | 'edit';
}

export type MasterFormDialogResult = boolean;

// The Add/Edit dialog, its fields built from config.formFields — see
// master-entity-config.model.ts's own comment for why this isn't one
// hand-written dialog per entity. View has its own dedicated, genuinely
// read-only presentation in master-view-dialog.component.ts, not this
// component in a disabled state (that was the previous round's shortcut,
// explicitly called out as insufficient).
@Component({
  selector: 'app-master-form-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, ButtonComponent, InputComponent, SelectComponent, ComboboxComponent, CheckboxComponent, TextareaComponent],
  templateUrl: './master-form-dialog.component.html',
  styleUrl: './master-form-dialog.component.scss',
})
export class MasterFormDialogComponent implements OnInit {
  private readonly masterApi = inject(MasterApiService);
  private readonly dialogRef = inject(DialogRef<MasterFormDialogResult>);

  protected readonly isEdit: boolean;
  protected readonly dialogTitle: string;
  protected readonly saving = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly form: FormGroup;
  // Grouped for the template's own two-column grid + a separate compact
  // checkbox area (see master-form-dialog.component.html's own comment) —
  // boolean fields render together in their own dense grid instead of each
  // taking a full text-field-height row interleaved with unrelated fields.
  // Each group keeps its fields' original relative order from formFields.
  protected readonly nonBooleanFields: MasterFormField[];
  protected readonly booleanFields: MasterFormField[];
  // Dynamically loaded dropdown options for every field with an
  // `optionsSource` (foreign-key fields — see master-entity-config.model.ts's
  // own comment), keyed by field key.
  protected readonly dynamicOptions = signal<Record<string, { label: string; value: unknown }[]>>({});
  // Loading/error state per optionsSource field, for app-combobox's own
  // [loading] input — distinct from an empty options() array, which also
  // legitimately happens while a cascaded field's driver has no value yet.
  protected readonly loadingOptions = signal<Record<string, boolean>>({});
  protected readonly optionsError = signal<Record<string, boolean>>({});

  constructor(@Inject(DIALOG_DATA) public data: MasterFormDialogData) {
    this.isEdit = data.mode === 'edit';
    this.dialogTitle = (this.isEdit ? 'Edit' : 'New') + ' ' + data.config.entityLabel;
    this.nonBooleanFields = data.config.formFields.filter((f) => f.type !== 'boolean');
    this.booleanFields = data.config.formFields.filter((f) => f.type === 'boolean');

    const controls: Record<string, FormControl> = {};
    for (const field of data.config.formFields) {
      const initialValue = data.row ? (data.row[field.key] ?? (field.type === 'boolean' ? false : '')) : field.type === 'boolean' ? false : '';
      controls[field.key] = new FormControl(initialValue, field.required ? [Validators.required] : []);
    }
    // Preserve the id field (not itself a visible form field) so an Edit
    // submit carries it through unchanged.
    if (data.row) {
      controls[data.config.idField] = new FormControl(data.row[data.config.idField]);
    }
    this.form = new FormGroup(controls);
  }

  ngOnInit(): void {
    const fieldsByKey = new Map(this.data.config.formFields.map((f) => [f.key, f]));
    const sourcedFields = this.data.config.formFields.filter((f): f is MasterFormField & { optionsSource: NonNullable<MasterFormField['optionsSource']> } => !!f.optionsSource);
    for (const field of sourcedFields) {
      const { apiBasePath, valueField, labelField, filterParams } = field.optionsSource;

      if (!filterParams || Object.keys(filterParams).length === 0) {
        this.setLoading(field.key, true);
        this.masterApi.get<Record<string, unknown>, Record<string, unknown>>(apiBasePath, { searchText: null, isActive: true }).subscribe({
          next: (rows) => this.applyOptions(field.key, rows, valueField, labelField),
          error: () => this.setError(field.key),
        });
        continue;
      }

      // Cascaded field: don't load until every REQUIRED driving field (see
      // optionsSource.filterParams's own comment) has a value, and reload
      // whenever any of them changes. A driver whose own form field is
      // optional (e.g. Software on Submenu/VerticalMenu's own Main Menu/
      // Vertical Menu cascade — confirmed optional in the live spec) may
      // legitimately stay empty; that's a real, valid "no filter" state,
      // not an incomplete one, so it's sent through as null rather than
      // blocking this field from ever loading at all — CONFIRMED LIVE bug
      // otherwise: Edit on a row whose Software is blank (a "common" entry)
      // left Main Menu/Vertical Menu stuck on "Select…" with no options and
      // no way to show the row's own already-saved value.
      const driverEntries = Object.entries(filterParams); // [requestParamName, thisFormFieldKey][]
      const driverStreams = driverEntries.map(([, formKey]) => {
        const control = this.form.get(formKey)!;
        return control.valueChanges.pipe(startWith(control.value));
      });

      combineLatest(driverStreams).subscribe((driverValues) => {
        const allRequiredPresent = driverEntries.every(([, formKey], i) => {
          if (!fieldsByKey.get(formKey)?.required) return true;
          const v = driverValues[i];
          return v !== null && v !== undefined && v !== '';
        });
        if (!allRequiredPresent) {
          this.dynamicOptions.update((current) => ({ ...current, [field.key]: [] }));
          return;
        }
        const body: Record<string, unknown> = { searchText: null, isActive: true };
        driverEntries.forEach(([paramName], i) => {
          const v = driverValues[i];
          body[paramName] = v === '' || v === undefined ? null : v;
        });
        this.setLoading(field.key, true);
        this.masterApi.get<Record<string, unknown>, Record<string, unknown>>(apiBasePath, body).subscribe({
          next: (rows) => this.applyOptions(field.key, rows, valueField, labelField),
          error: () => this.setError(field.key),
        });
      });
    }
  }

  private applyOptions(fieldKey: string, rows: Record<string, unknown>[], valueField: string, labelField: string): void {
    const opts = rows.map((row) => ({ label: String(row[labelField] ?? ''), value: row[valueField] }));
    this.dynamicOptions.update((current) => ({ ...current, [fieldKey]: opts }));
    this.setLoading(fieldKey, false);
    this.optionsError.update((current) => ({ ...current, [fieldKey]: false }));

    // A parent filter changed (or the initial load came back) and the
    // currently selected value for this field is no longer among the valid
    // options for the new parent — clear it rather than silently submitting
    // a stale/invalid foreign key.
    const control = this.form.get(fieldKey);
    if (control && control.value && !opts.some((o) => o.value === control.value)) {
      control.setValue('');
    }
  }

  private setLoading(fieldKey: string, loading: boolean): void {
    this.loadingOptions.update((current) => ({ ...current, [fieldKey]: loading }));
  }

  private setError(fieldKey: string): void {
    this.setLoading(fieldKey, false);
    this.optionsError.update((current) => ({ ...current, [fieldKey]: true }));
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
    if (this.saving()) return; // already in flight — ignore a second trigger (Enter + click, double-click, etc.)

    this.saving.set(true);
    this.errorMessage.set(null);

    const payload = this.form.getRawValue();
    const call = this.isEdit
      ? this.masterApi.edit(this.data.config.apiBasePath, payload)
      : this.masterApi.add(this.data.config.apiBasePath, payload);

    call.subscribe({
      next: (res) => {
        this.saving.set(false);
        if (res.success) {
          this.dialogRef.close(true);
        } else {
          this.errorMessage.set(res.message || 'Save failed.');
        }
      },
      error: () => {
        this.saving.set(false);
        this.errorMessage.set('Something went wrong while saving.');
      },
    });
  }
}
