import { Component, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { DialogService } from '../../../shared/ui/dialog/dialog.service';
import { FormsModule } from '@angular/forms';
import { MasterApiService } from './master-api.service';
import { MasterEntityConfig } from './master-entity-config.model';
import type { SelectOption } from '../../../shared/ui/form/select.component';
import { MenuService } from '../../../core/services/menu.service';
import { MasterFormDialogComponent, MasterFormDialogData, MasterFormDialogResult } from './master-form-dialog.component';
import { MasterViewHistoryDialogComponent, MasterViewHistoryDialogData } from './master-view-history-dialog.component';
import { ConfirmDialogComponent } from './confirm-dialog.component';
import { buildColumnLookups, ColumnLookups, resolveColumnValue } from './column-lookup.util';
import { ButtonComponent } from '../../../shared/ui/button/button.component';
import { SelectComponent } from '../../../shared/ui/form/select.component';
import { PaginationComponent } from '../../../shared/ui/pagination/pagination.component';
import { EmptyStateComponent } from '../../../shared/ui/empty-state/empty-state.component';
import { IconComponent } from '../../../shared/ui/icon/icon.component';
import { MenuComponent } from '../../../shared/ui/menu/menu.component';
import { MenuTriggerDirective } from '../../../shared/ui/menu/menu-trigger.directive';
import { ToastService } from '../../../shared/ui/toast/toast.service';

type SortDirection = 'asc' | 'desc';

type ActiveFilter = 'active' | 'inactive' | 'all';

const ACTIVE_FILTER_OPTIONS = [
  { label: 'Active', value: 'active' },
  { label: 'Inactive', value: 'inactive' },
  { label: 'All', value: 'all' },
];

// One generic list screen for every master entity — table driven by
// config.columns, Add/Edit/View/Delete/History wired to MasterApiService,
// and its own action buttons gated by the REAL per-screen rights
// (canAdd/canEdit/canDelete) looked up from MenuService for whatever route
// this instance is mounted at. See master-entity-config.model.ts's own
// comment for why this is one shared component, not one per entity, and
// menu.service.ts's own findRightsForRoute() comment for where the rights
// come from.
@Component({
  selector: 'app-master-list',
  standalone: true,
  imports: [FormsModule, ButtonComponent, SelectComponent, PaginationComponent, EmptyStateComponent, IconComponent, MenuComponent, MenuTriggerDirective],
  templateUrl: './master-list.component.html',
  styleUrl: './master-list.component.scss',
})
export class MasterListComponent {
  private readonly masterApi = inject(MasterApiService);
  protected readonly menuService = inject(MenuService);
  private readonly dialog = inject(DialogService);
  private readonly toast = inject(ToastService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected config!: MasterEntityConfig;
  protected readonly loading = signal(false);
  protected readonly skeletonRows = [1, 2, 3, 4, 5];
  protected readonly activeFilterOptions = ACTIVE_FILTER_OPTIONS;

  // The real backend-provided icon for this screen's own menu leaf (see
  // menu.service.ts's own findIconForRoute() comment) — drives the page
  // header's own icon badge. Falls back to a plain neutral glyph (app-icon
  // itself already falls back for an unrecognized name — see icon-map.ts)
  // before the menu tree has loaded or for a leaf with no icon at all.
  protected readonly headerIcon = computed(
    () => this.config.headerIconOverride ?? this.menuService.findIconForRoute(this.router.url) ?? 'folder_open',
  );

  // The full fetched set (active + inactive — config.buildListRequest()
  // sends isActive: null, see its own comment). `rows` (the table's own
  // data source) applies the user's own Active/Inactive/All filter
  // client-side rather than a second request, so Delete still visibly
  // removes a row from the "Active" view immediately — then the user's own
  // column-header sort (client-side, over the already-fetched set; the
  // real /get endpoint has no sort param), applied before pagination.
  private readonly allRows = signal<Record<string, unknown>[]>([]);
  protected readonly activeFilter = signal<ActiveFilter>('active');
  protected readonly sortKey = signal<string | null>(null);
  protected readonly sortDir = signal<SortDirection>('asc');
  protected readonly rows = computed(() => {
    const filter = this.activeFilter();
    const filtered =
      filter === 'all' ? this.allRows() : this.allRows().filter((r) => (r['isActive'] !== false) === (filter === 'active'));

    const key = this.sortKey();
    if (!key) return filtered;
    const dir = this.sortDir() === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const av = a[key];
      const bv = b[key];
      if (av == null && bv == null) return 0;
      if (av == null) return -1 * dir;
      if (bv == null) return 1 * dir;
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
      return String(av).localeCompare(String(bv)) * dir;
    });
  });

  toggleSort(key: string): void {
    if (this.sortKey() === key) {
      this.sortDir.set(this.sortDir() === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortKey.set(key);
      this.sortDir.set('asc');
    }
  }

  // Foreign-key id -> row lookups for any resolveFrom column (e.g. Area's
  // own Country/State/City/Postal Code columns — see column-lookup.util.ts's
  // own comment), fetched once per list load alongside the main request.
  protected readonly columnLookups = signal<ColumnLookups>({});
  protected readonly resolveCell = (row: Record<string, unknown>, column: MasterEntityConfig['columns'][number]) => resolveColumnValue(row, column, this.columnLookups());

  // Client-side pagination only — the real /get endpoint has no
  // page/pageSize params (see loadList()'s own call), so this slices the
  // already-fetched rows() for display rather than requesting pages from
  // the API.
  protected readonly pageSize = 10;
  protected readonly page = signal(1);
  protected readonly pagedRows = computed(() => {
    const start = (this.page() - 1) * this.pageSize;
    return this.rows().slice(start, start + this.pageSize);
  });

  // Search is now an explicit action (Search button / Enter key), matching
  // the reference screenshots' own toolbar — searchDisplay is just the
  // input's own live value until the user asks for a search.
  protected readonly searchDisplay = signal('');
  private searchText = '';

  // A single selected row drives the Edit/Delete/View History buttons in
  // the footer, replacing the previous per-row "…" action menu — matching
  // the reference list screens, which have no actions column at all.
  protected readonly selectedRow = signal<Record<string, unknown> | null>(null);
  protected readonly statusMessage = signal<string | null>(null);

  protected readonly rights = signal({ canView: true, canAdd: false, canEdit: false, canDelete: false });
  private hasFetchedList = false;

  // Extra, entity-specific toolbar filter dropdowns (e.g. Vertical Menu
  // Master's own Software/Main Menu) — see master-entity-config.model.ts's
  // own MasterExtraFilter comment for why these are real server-side
  // params, committed only on Find/Refresh, not live-filtered client-side
  // the way activeFilter is. Empty for every entity without extraFilters.
  protected readonly extraFilterValues = signal<Record<string, string>>({});
  protected readonly extraFilterOptions = signal<Record<string, SelectOption[]>>({});
  // Only entities declaring extraFilters (currently Vertical Menu Master)
  // carry enough toolbar controls to genuinely overflow a normal desktop
  // width — see master-list.component.html's own toolbar-divider--break
  // comment. Every other entity's toolbar is unaffected without this.
  protected readonly hasExtraFilters = computed(() => !!this.config.extraFilters?.length);

  // Opts the table into `table-layout: fixed` so a column's own explicit
  // MasterColumn.width (see that model's own comment) is actually respected
  // instead of being just a hint the browser's default auto layout can
  // override for a long unbroken value elsewhere in the row (e.g. Sub Menu's
  // own Menu URL column) — scoped to entities that declare at least one
  // column width (currently only Sub Menu Master), so every other entity's
  // existing auto-sized table is completely unaffected.
  protected readonly hasColumnWidths = computed(() => this.config.columns.some((c) => !!c.width));

  constructor() {
    this.config = this.route.snapshot.data['config'] as MasterEntityConfig;

    if (this.config.extraFilters?.length) {
      const initial: Record<string, string> = {};
      // A query param matching one of this entity's own extraFilters' key
      // (e.g. ?roleId=... arriving from Role Master's own "Role Rights"
      // button — see MasterEntityConfig.secondaryAction's own comment)
      // seeds that filter's initial value instead of "All {label}", so the
      // list loads already scoped to it on arrival rather than requiring an
      // extra manual Find click.
      const queryParams = this.route.snapshot.queryParamMap;
      for (const filter of this.config.extraFilters) {
        initial[filter.key] = queryParams.get(filter.key) ?? '';
        this.masterApi.get<Record<string, unknown>, Record<string, unknown>>(filter.apiBasePath, { searchText: null, isActive: true }).subscribe((optionRows) => {
          const opts: SelectOption[] = [
            { label: `All ${filter.label}`, value: '' },
            ...optionRows.map((r) => ({ label: String(r[filter.labelField] ?? ''), value: String(r[filter.valueField]) })),
          ];
          this.extraFilterOptions.update((current) => ({ ...current, [filter.key]: opts }));
        });
      }
      this.extraFilterValues.set(initial);
    }

    // Rights come from MenuService's own async fetch of the real per-user
    // admin/user-rights/me response (see menu.service.ts's own comment) --
    // reactive, not a one-time snapshot, because this component mounts (via
    // RouterOutlet) at the same time as SidenavComponent kicks off that
    // fetch, not after it resolves. A one-time read defaulted to
    // canView: true while rights were still loading, so a user without
    // real access to this screen could see its data anyway if the HTTP
    // response hadn't arrived yet when this component's ngOnInit ran.
    effect(() => {
      if (!this.menuService.hasLoaded()) return;
      const found = this.menuService.findRightsForRoute(this.router.url);
      // No matching leaf in the user's own rights tree at all = no access,
      // fail closed rather than the previous always-true default.
      this.rights.set(found ?? { canView: false, canAdd: false, canEdit: false, canDelete: false });

      if (!this.hasFetchedList && this.rights().canView) {
        this.hasFetchedList = true;
        this.loadList();
      }
    });
  }

  loadList(): void {
    this.loading.set(true);
    this.selectedRow.set(null);
    this.masterApi
      .get<Record<string, unknown>, Record<string, unknown>>(this.config.apiBasePath, this.config.buildListRequest(this.searchText, this.extraFilterValues()))
      .subscribe({
        next: (rows) => {
          this.loading.set(false);
          this.allRows.set(rows);
          this.page.set(1);
          this.statusMessage.set(`${this.config.entityLabelPlural} data loaded successfully.`);
        },
        error: () => {
          this.loading.set(false);
          this.allRows.set([]);
          this.page.set(1);
          this.statusMessage.set(null);
        },
      });

    buildColumnLookups(this.masterApi, this.config.columns).subscribe((lookups) => this.columnLookups.set(lookups));
  }

  search(): void {
    this.searchText = this.searchDisplay().trim();
    this.loadList();
  }

  setExtraFilter(key: string, value: string): void {
    this.extraFilterValues.update((current) => ({ ...current, [key]: value }));
  }

  // See MasterEntityConfig.secondaryAction's own comment (e.g. Role
  // Master's own "Role Rights" button) — navigates to the configured
  // target screen with the selected row's own id as that screen's matching
  // extraFilters query param, so it arrives already scoped to this row.
  openSecondaryAction(): void {
    const action = this.config.secondaryAction;
    const row = this.selectedRow();
    if (!action || !row) return;
    this.router.navigate([action.targetRoute], { queryParams: { [action.queryParamKey]: row[this.config.idField] } });
  }

  selectRow(row: Record<string, unknown>): void {
    const current = this.selectedRow();
    const same = current && current[this.config.idField] === row[this.config.idField];
    this.selectedRow.set(same ? null : row);
  }

  // The per-row "⋮" actions menu always selects its own row (never
  // toggles it off) before opening — distinct from selectRow()'s own
  // click-to-toggle behavior on the row itself, so opening the menu on an
  // already-selected row can't accidentally deselect it out from under the
  // menu's own Edit/Delete/View History items (which all read
  // selectedRow()).
  selectRowForMenu(row: Record<string, unknown>): void {
    this.selectedRow.set(row);
  }

  protected isSelected(row: Record<string, unknown>): boolean {
    const current = this.selectedRow();
    return !!current && current[this.config.idField] === row[this.config.idField];
  }

  clearSearch(): void {
    this.searchDisplay.set('');
    this.searchText = '';
    this.loadList();
  }

  refresh(): void {
    this.loadList();
  }

  onPageChange(page: number): void {
    this.page.set(page);
  }

  openAdd(): void {
    this.dialog
      .open<MasterFormDialogComponent, MasterFormDialogData, MasterFormDialogResult>(MasterFormDialogComponent, {
        width: '720px',
        maxWidth: '94vw',
        data: { config: this.config, row: null, mode: 'add' },
      })
      .afterClosed()
      .subscribe((result) => {
        if (result) {
          this.loadList();
          this.notify(`${this.config.entityLabel} added.`);
        }
      });
  }

  openEdit(): void {
    const row = this.selectedRow();
    if (!row) return;
    this.dialog
      .open<MasterFormDialogComponent, MasterFormDialogData, boolean>(MasterFormDialogComponent, {
        width: '720px',
        maxWidth: '94vw',
        data: { config: this.config, row, mode: 'edit' },
      })
      .afterClosed()
      .subscribe((saved) => {
        if (saved) {
          this.loadList();
          this.notify(`${this.config.entityLabel} updated.`);
        }
      });
  }

  // Single entry point for both "View Data" and "History Data" — see
  // master-view-history-dialog.component.ts's own comment for why these
  // are one tabbed dialog rather than two, matching the reference
  // screenshots' own "View [Entity] & History" dialogs. The list footer's
  // own "View History" button is this dialog's only trigger (the
  // reference list screens have no separate "View" button).
  openViewHistory(): void {
    const row = this.selectedRow();
    if (!row) return;
    this.dialog.open<MasterViewHistoryDialogComponent, MasterViewHistoryDialogData>(MasterViewHistoryDialogComponent, {
      width: '720px',
      maxWidth: '94vw',
      data: { config: this.config, row },
    });
  }

  deleteRow(): void {
    const row = this.selectedRow();
    if (!row) return;
    this.dialog
      .open(ConfirmDialogComponent, {
        width: '420px',
        data: {
          title: `Delete ${this.config.entityLabel}`,
          // Accurate, not implying permanent deletion — CONFIRMED LIVE
          // this backend does a soft delete (sets isActive: false), see
          // master-entity-config.model.ts's own buildListRequest comment.
          message: `This will deactivate this ${this.config.entityLabel.toLowerCase()} and remove it from the active list. Its history is preserved, but it won't be reachable from this screen afterward. This action is not reversible from this screen.`,
        },
      })
      .afterClosed()
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.masterApi.delete(this.config.apiBasePath, this.config.buildDeleteRequest(row)).subscribe({
          next: (res) => {
            if (res.success) {
              this.loadList();
              this.notify(`${this.config.entityLabel} deactivated.`);
            } else {
              this.notify(res.message || `Failed to deactivate this ${this.config.entityLabel.toLowerCase()}.`, 'error');
            }
          },
          error: () => this.notify(`Something went wrong while deactivating this ${this.config.entityLabel.toLowerCase()}.`, 'error'),
        });
      });
  }

  private notify(message: string, variant: 'default' | 'error' = 'default'): void {
    this.toast.show(message, variant);
  }
}
