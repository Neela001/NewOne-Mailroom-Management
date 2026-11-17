import { Component, Inject, OnInit, inject, signal } from '@angular/core';
import { DIALOG_DATA } from '../../../shared/ui/dialog/dialog-data.token';
import { DialogRef } from '../../../shared/ui/dialog/dialog-ref';
import { MasterApiService } from './master-api.service';
import { MasterEntityConfig, MasterFormField } from './master-entity-config.model';
import { buildColumnLookups, ColumnLookups, resolveColumnValue } from './column-lookup.util';
import { normalizeRowKeys } from './pascal-case.util';
import { ButtonComponent } from '../../../shared/ui/button/button.component';

export interface MasterViewHistoryDialogData {
  config: MasterEntityConfig;
  row: Record<string, unknown>;
}

interface DetailItem {
  label: string;
  value: string;
  isEmpty: boolean;
}

type Tab = 'view' | 'history';

// One dialog, two tabs ("View Data" / "History Data") — matching the
// reference's own "View [Entity] & History" screenshots exactly, replacing
// what used to be two separate dialogs (MasterViewDialogComponent /
// MasterHistoryDialogComponent, now folded in here) triggered by two
// separate row actions. The reference list screens only have one trigger
// for this ("View History" in the footer button row — see
// master-list.component.ts's own openViewHistory()), landing on View Data
// first since that's the more commonly-needed tab.
//
// View Data: a genuine read-only details presentation (not the Add/Edit
// form reused disabled) — foreign-key fields (optionsSource) resolve to
// their real label the same way the Add/Edit dialog's own dropdown does.
// History Data: the real /history/get audit trail — any history column
// with resolveFrom (see column-lookup.util.ts's own comment) resolves a
// bare id (e.g. a City history row's own countryId) to its real name the
// same way the list table's own resolved columns do, since the history
// response carries the same bare ids, never a denormalized name.
@Component({
  selector: 'app-master-view-history-dialog',
  standalone: true,
  imports: [ButtonComponent],
  templateUrl: './master-view-history-dialog.component.html',
  styleUrl: './master-view-history-dialog.component.scss',
})
export class MasterViewHistoryDialogComponent implements OnInit {
  private readonly masterApi = inject(MasterApiService);
  protected readonly dialogRef = inject(DialogRef);

  protected readonly tab = signal<Tab>('view');

  protected readonly viewItems = signal<DetailItem[]>([]);
  protected readonly viewLoading = signal(true);

  protected readonly historyLoading = signal(false);
  protected readonly historyRows = signal<Record<string, unknown>[]>([]);
  protected readonly historyLookups = signal<ColumnLookups>({});
  protected readonly resolveHistoryCell = (row: Record<string, unknown>, column: MasterEntityConfig['historyColumns'][number]) =>
    resolveColumnValue(row, column, this.historyLookups());

  constructor(@Inject(DIALOG_DATA) public data: MasterViewHistoryDialogData) {}

  ngOnInit(): void {
    this.loadViewData();
    this.loadHistory();
  }

  setTab(tab: Tab): void {
    this.tab.set(tab);
  }

  private loadViewData(): void {
    const fields = this.data.config.formFields;
    const sourcedFields = fields.filter((f): f is MasterFormField & { optionsSource: NonNullable<MasterFormField['optionsSource']> } => !!f.optionsSource);

    if (sourcedFields.length === 0) {
      this.viewItems.set(fields.map((f) => this.toItem(f)));
      this.viewLoading.set(false);
      return;
    }

    let pending = sourcedFields.length;
    const resolvedLabels: Record<string, string> = {};

    for (const field of sourcedFields) {
      const { apiBasePath, valueField, labelField } = field.optionsSource;
      const rawValue = this.data.row[field.key];
      if (!rawValue) {
        pending--;
        continue;
      }
      this.masterApi.get<Record<string, unknown>, Record<string, unknown>>(apiBasePath, { searchText: null, isActive: null }).subscribe({
        next: (rows) => {
          const match = rows.find((r) => r[valueField] === rawValue);
          if (match) resolvedLabels[field.key] = String(match[labelField] ?? '');
          pending--;
          if (pending === 0) this.finishView(resolvedLabels);
        },
        error: () => {
          pending--;
          if (pending === 0) this.finishView(resolvedLabels);
        },
      });
    }
    if (pending === 0) this.finishView(resolvedLabels);
  }

  private finishView(resolvedLabels: Record<string, string>): void {
    this.viewItems.set(this.data.config.formFields.map((f) => this.toItem(f, resolvedLabels[f.key])));
    this.viewLoading.set(false);
  }

  private toItem(field: MasterFormField, resolvedLabel?: string): DetailItem {
    const raw = this.data.row[field.key];

    if (field.type === 'boolean') {
      return { label: field.label, value: raw ? 'Yes' : 'No', isEmpty: false };
    }
    if (resolvedLabel) {
      return { label: field.label, value: resolvedLabel, isEmpty: false };
    }
    if (raw === null || raw === undefined || raw === '') {
      return { label: field.label, value: 'Not set', isEmpty: true };
    }
    // A static option list (e.g. User Master's own User Type — real stored
    // values are 'EMPLOYEE'/'VENDORSTAFF', not their own display labels)
    // shows its real label instead of the raw stored value, the same way a
    // resolveFrom/optionsSource field already does above — a no-op for
    // every existing field whose own label already equals its value.
    const staticOption = field.options?.find((o) => o.value === raw);
    if (staticOption) {
      return { label: field.label, value: staticOption.label, isEmpty: false };
    }
    return { label: field.label, value: String(raw), isEmpty: false };
  }

  private loadHistory(): void {
    this.historyLoading.set(true);
    this.masterApi
      .history<Record<string, unknown>, Record<string, unknown>>(this.data.config.apiBasePath, this.data.config.buildHistoryRequest(this.data.row))
      .subscribe({
        next: (rows) => {
          this.historyLoading.set(false);
          this.historyRows.set(this.data.config.historyRowsArePascalCase ? rows.map((r) => normalizeRowKeys(r)) : rows);
        },
        error: () => this.historyLoading.set(false),
      });

    buildColumnLookups(this.masterApi, this.data.config.historyColumns).subscribe((lookups) => this.historyLookups.set(lookups));
  }
}
