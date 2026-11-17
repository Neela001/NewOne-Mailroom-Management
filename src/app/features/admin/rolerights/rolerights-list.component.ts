import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MenuService } from '../../../core/services/menu.service';
import { ApiService } from '../../../core/services/api.service';
import { MasterApiService } from '../../master/shared/master-api.service';
import { MasterColumn } from '../../master/shared/master-entity-config.model';
import { buildColumnLookups, resolveColumnValue } from '../../master/shared/column-lookup.util';
import { DialogService } from '../../../shared/ui/dialog/dialog.service';
import { ConfirmDialogComponent } from '../../master/shared/confirm-dialog.component';
import { MasterViewHistoryDialogComponent, MasterViewHistoryDialogData } from '../../master/shared/master-view-history-dialog.component';
import { ROLERIGHTS_CONFIG } from './rolerights.config';
import { ButtonComponent } from '../../../shared/ui/button/button.component';
import { SelectComponent, SelectOption } from '../../../shared/ui/form/select.component';
import { CheckboxComponent } from '../../../shared/ui/form/checkbox.component';
import { IconComponent } from '../../../shared/ui/icon/icon.component';
import { EmptyStateComponent } from '../../../shared/ui/empty-state/empty-state.component';
import { ToastService } from '../../../shared/ui/toast/toast.service';

type PermissionField = 'canView' | 'canAdd' | 'canEdit' | 'canDelete';
type AssignedFilter = 'all' | 'assigned' | 'notassigned';

interface MatrixRow {
  subMenuId: string;
  roleRightId: string | null;
  softwareId: string | null;
  softwareName: string;
  mainMenuId: string | null;
  mainMenuName: string;
  verticalMenuId: string | null;
  verticalMenuName: string;
  subMenuCode: string;
  subMenuName: string;
  isActive: boolean; // the SUBMENU's own active flag, not the right's
  originalCanView: boolean;
  originalCanAdd: boolean;
  originalCanEdit: boolean;
  originalCanDelete: boolean;
  canView: boolean;
  canAdd: boolean;
  canEdit: boolean;
  canDelete: boolean;
}

// Real resolveFrom column defs matching SUBMENU_CONFIG's own, reused here
// (via column-lookup.util.ts's own generic buildColumnLookups/
// resolveColumnValue) to name the menu catalog's bare softwareId/
// mainMenuId/verticalMenuId — not a second, hand-rolled join.
const MENU_NAME_COLUMNS: MasterColumn[] = [
  { key: 'softwareName', label: 'Software', resolveFrom: { apiBasePath: 'admin/software', fromField: 'softwareId', toField: 'softwareId', labelField: 'softwareName' } },
  { key: 'mainMenuName', label: 'Main Menu', resolveFrom: { apiBasePath: 'admin/mainmenu', fromField: 'mainMenuId', toField: 'mainMenuId', labelField: 'mainMenuName' } },
  { key: 'verticalMenuName', label: 'Vertical Menu', resolveFrom: { apiBasePath: 'admin/verticalmenu', fromField: 'verticalMenuId', toField: 'verticalMenuId', labelField: 'verticalMenuName' } },
];

// Dedicated, non-generic feature — NOT routed through MasterListComponent/
// MasterEntityConfig, unlike every other admin/master entity. CONFIRMED
// (reflection of D:\NewOne's own RoleRightsForm, 2026-11-11 — see this
// session's own investigation report) that the real Windows reference
// screen is a per-role PERMISSION MATRIX (every menu always shown, with
// View/Add/Edit/Delete checkboxes, Allow/Clear Shown, Undo, batch Save),
// not a flat add/edit-one-row-at-a-time list — the shape the generic
// MasterEntityConfig trio assumes. ROLERIGHTS_CONFIG (rolerights.config.ts)
// is kept and reused here, not deleted, purely to drive the per-row "View
// History" action via the already-existing MasterViewHistoryDialogComponent
// (its own real admin/rolerights/history/get endpoint, unchanged).
//
// CONFIRMED LIVE (real backend, real account, 2026-11-11): Administrator's
// own 49 permission rows (one per real SubMenu, including inactive ones)
// were created by actionBy "Admin menu policy" / remarks "Automatic
// administrator permission" — a real backend-side automatic process, not
// manually seeded data and not something this UI computes or grants itself.
// A normal role's own rows (e.g. Manager, 23 of 49) show actionBy "admin"
// with no such remarks — ordinary, explicit assignment through this exact
// same API every role uses. This component therefore NEVER special-cases
// any role: it reads and writes admin/rolerights exactly the same way for
// Administrator as for any other role — see this session's own
// investigation report for the full evidence trail.
@Component({
  selector: 'app-rolerights-list',
  standalone: true,
  imports: [FormsModule, ButtonComponent, SelectComponent, CheckboxComponent, IconComponent, EmptyStateComponent],
  templateUrl: './rolerights-list.component.html',
  styleUrl: './rolerights-list.component.scss',
})
export class RoleRightsListComponent {
  private readonly masterApi = inject(MasterApiService);
  private readonly api = inject(ApiService);
  protected readonly menuService = inject(MenuService);
  private readonly dialog = inject(DialogService);
  private readonly toast = inject(ToastService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly headerIcon = computed(() => this.menuService.findIconForRoute(this.router.url) ?? 'admin_panel_settings');
  protected readonly rights = signal({ canView: true, canAdd: false, canEdit: false, canDelete: false });
  private hasInitialized = false;

  protected readonly loadingCatalog = signal(false);
  protected readonly loadingRole = signal(false);
  protected readonly saving = signal(false);
  protected readonly statusMessage = signal<string | null>(null);

  protected readonly roleOptions = signal<SelectOption[]>([{ label: 'Select a role…', value: '' }]);
  protected readonly softwareOptions = signal<SelectOption[]>([{ label: 'All Software', value: '' }]);
  protected readonly mainMenuOptions = signal<SelectOption[]>([{ label: 'All Main Menu', value: '' }]);
  protected readonly assignedOptions: SelectOption[] = [
    { label: 'All', value: 'all' },
    { label: 'Assigned', value: 'assigned' },
    { label: 'Not Assigned', value: 'notassigned' },
  ];

  protected readonly selectedRoleId = signal('');
  protected readonly softwareFilter = signal('');
  protected readonly mainMenuFilter = signal('');
  protected readonly searchText = signal('');
  protected readonly assignedFilter = signal<AssignedFilter>('all');

  // The full menu catalog — fetched ONCE, independent of the selected role
  // (matches the real Windows app's own GetRoleRightsMenusAsync() being a
  // no-parameter call — see this session's own investigation report).
  private readonly catalog = signal<Omit<MatrixRow, 'roleRightId' | 'originalCanView' | 'originalCanAdd' | 'originalCanEdit' | 'originalCanDelete' | 'canView' | 'canAdd' | 'canEdit' | 'canDelete'>[]>([]);

  // Composed fresh every time the selected role changes — see
  // selectRole()'s own comment for why this can never leak a previous
  // role's own rows.
  protected readonly matrixRows = signal<MatrixRow[]>([]);

  protected readonly shownRows = computed(() => {
    const software = this.softwareFilter();
    const mainMenu = this.mainMenuFilter();
    const search = this.searchText().trim().toLowerCase();
    const assigned = this.assignedFilter();
    return this.matrixRows().filter((row) => {
      if (software && row.softwareId !== software) return false;
      if (mainMenu && row.mainMenuId !== mainMenu) return false;
      if (assigned === 'assigned' && !row.roleRightId) return false;
      if (assigned === 'notassigned' && row.roleRightId) return false;
      if (search) {
        const haystack = `${row.subMenuCode} ${row.subMenuName} ${row.mainMenuName} ${row.verticalMenuName} ${row.softwareName}`.toLowerCase();
        if (!haystack.includes(search)) return false;
      }
      return true;
    });
  });

  protected readonly assignedCount = computed(() => this.matrixRows().filter((r) => r.roleRightId).length);
  protected readonly changedRows = computed(() => this.matrixRows().filter((r) => this.isChanged(r)));
  protected readonly hasUnsavedChanges = computed(() => this.changedRows().length > 0);

  constructor() {
    effect(() => {
      if (!this.menuService.hasLoaded()) return;
      const found = this.menuService.findRightsForRoute(this.router.url);
      this.rights.set(found ?? { canView: false, canAdd: false, canEdit: false, canDelete: false });

      if (!this.hasInitialized && this.rights().canView) {
        this.hasInitialized = true;
        this.initialize();
      }
    });
  }

  private initialize(): void {
    this.loadingCatalog.set(true);

    this.masterApi.get<Record<string, unknown>, Record<string, unknown>>('admin/role', { searchText: null, isActive: true }).subscribe((rows) => {
      this.roleOptions.set([{ label: 'Select a role…', value: '' }, ...rows.map((r) => ({ label: String(r['roleName'] ?? ''), value: String(r['roleId']) }))]);
    });
    this.masterApi.get<Record<string, unknown>, Record<string, unknown>>('admin/software', { searchText: null, isActive: true }).subscribe((rows) => {
      this.softwareOptions.set([{ label: 'All Software', value: '' }, ...rows.map((r) => ({ label: String(r['softwareName'] ?? ''), value: String(r['softwareId']) }))]);
    });
    this.masterApi.get<Record<string, unknown>, Record<string, unknown>>('admin/mainmenu', { searchText: null, isActive: true }).subscribe((rows) => {
      this.mainMenuOptions.set([{ label: 'All Main Menu', value: '' }, ...rows.map((r) => ({ label: String(r['mainMenuName'] ?? ''), value: String(r['mainMenuId']) }))]);
    });

    this.masterApi.get<Record<string, unknown>, Record<string, unknown>>('admin/submenu', { searchText: null, isActive: null }).subscribe((rows) => {
      buildColumnLookups(this.masterApi, MENU_NAME_COLUMNS).subscribe((lookups) => {
        const catalog = rows.map((row) => ({
          subMenuId: String(row['subMenuId']),
          softwareId: (row['softwareId'] as string) ?? null,
          softwareName: String(resolveColumnValue(row, MENU_NAME_COLUMNS[0], lookups) ?? ''),
          mainMenuId: (row['mainMenuId'] as string) ?? null,
          mainMenuName: String(resolveColumnValue(row, MENU_NAME_COLUMNS[1], lookups) ?? ''),
          verticalMenuId: (row['verticalMenuId'] as string) ?? null,
          verticalMenuName: String(resolveColumnValue(row, MENU_NAME_COLUMNS[2], lookups) ?? ''),
          subMenuCode: String(row['subMenuCode'] ?? ''),
          subMenuName: String(row['subMenuName'] ?? ''),
          isActive: row['isActive'] !== false,
        }));
        this.catalog.set(catalog);
        this.loadingCatalog.set(false);

        // A deep link from Role Master's own "Role Rights" button (see
        // role.config.ts's own secondaryAction comment) — pick up its
        // ?roleId=... the same way MasterListComponent's own extraFilters
        // do, now that the catalog (needed to compose the matrix) is ready.
        const roleIdParam = this.route.snapshot.queryParamMap.get('roleId');
        if (roleIdParam) this.selectRole(roleIdParam);
      });
    });
  }

  selectRole(roleId: string): void {
    if (this.hasUnsavedChanges()) {
      this.dialog
        .open(ConfirmDialogComponent, {
          width: '420px',
          data: { title: 'Unsaved changes', message: 'Switching roles will discard your unsaved permission changes. Continue?' },
        })
        .afterClosed()
        .subscribe((confirmed) => {
          if (confirmed) this.doSelectRole(roleId);
        });
      return;
    }
    this.doSelectRole(roleId);
  }

  // Always rebuilds matrixRows from scratch for the newly selected role (or
  // clears it entirely for ''), never patches the previous role's own rows
  // in place — the only way to guarantee role switching can't leak a
  // previous role's own permissions onto the next one.
  private doSelectRole(roleId: string): void {
    this.selectedRoleId.set(roleId);
    this.matrixRows.set([]);
    if (!roleId) return;

    this.loadingRole.set(true);
    this.statusMessage.set(null);
    this.masterApi.get<Record<string, unknown>, Record<string, unknown>>('admin/rolerights', { searchText: null, isActive: null, roleId }).subscribe({
      next: (rows) => {
        const bySubMenu = new Map(rows.map((r) => [String(r['subMenuId']), r]));
        const composed = this.catalog().map((menu): MatrixRow => {
          const right = bySubMenu.get(menu.subMenuId);
          const canView = !!right?.['canView'];
          const canAdd = !!right?.['canAdd'];
          const canEdit = !!right?.['canEdit'];
          const canDelete = !!right?.['canDelete'];
          return {
            ...menu,
            roleRightId: right ? String(right['roleRightId']) : null,
            originalCanView: canView,
            originalCanAdd: canAdd,
            originalCanEdit: canEdit,
            originalCanDelete: canDelete,
            canView,
            canAdd,
            canEdit,
            canDelete,
          };
        });
        this.matrixRows.set(composed);
        this.loadingRole.set(false);
        this.statusMessage.set(`${rows.length} of ${this.catalog().length} menus assigned.`);
      },
      error: () => {
        this.loadingRole.set(false);
        this.matrixRows.set([]);
      },
    });
  }

  protected isChanged(row: MatrixRow): boolean {
    return row.canView !== row.originalCanView || row.canAdd !== row.originalCanAdd || row.canEdit !== row.originalCanEdit || row.canDelete !== row.originalCanDelete;
  }

  // Add/Edit/Delete require View — INFERRED, not confirmed from the live
  // API (the real WinForms RoleRightsForm has its own CanTouch()/
  // InvalidChange() methods, confirming SOME real dependency-validation
  // layer exists, but reflection can't read their exact IL logic without a
  // decompiler). Applied only as a client-side UX guard — disables the
  // dependent checkboxes and clears them if View is turned off — never as
  // an invented server-side rule, and the Save payload sends whatever the
  // UI state actually is rather than silently correcting it further.
  protected canTouch(row: MatrixRow, field: PermissionField): boolean {
    if (field === 'canView') return true;
    return row.canView;
  }

  toggleFlag(row: MatrixRow, field: PermissionField): void {
    if (!this.canTouch(row, field)) return;
    this.matrixRows.update((rows) =>
      rows.map((r) => {
        if (r.subMenuId !== row.subMenuId) return r;
        const next = { ...r, [field]: !r[field] };
        if (field === 'canView' && !next.canView) {
          next.canAdd = false;
          next.canEdit = false;
          next.canDelete = false;
        }
        return next;
      }),
    );
  }

  undoRow(row: MatrixRow): void {
    this.matrixRows.update((rows) =>
      rows.map((r) =>
        r.subMenuId === row.subMenuId
          ? { ...r, canView: r.originalCanView, canAdd: r.originalCanAdd, canEdit: r.originalCanEdit, canDelete: r.originalCanDelete }
          : r,
      ),
    );
  }

  // Column header tri-state — reflects only the currently shown (filtered)
  // rows, matching Allow Shown/Clear Shown's own "shown" scope below.
  protected headerState(field: PermissionField): 'checked' | 'unchecked' | 'indeterminate' {
    const rows = this.shownRows();
    if (rows.length === 0) return 'unchecked';
    const checkedCount = rows.filter((r) => r[field]).length;
    if (checkedCount === 0) return 'unchecked';
    if (checkedCount === rows.length) return 'checked';
    return 'indeterminate';
  }

  toggleColumn(field: PermissionField): void {
    const target = this.headerState(field) !== 'checked';
    const shownIds = new Set(this.shownRows().map((r) => r.subMenuId));
    this.matrixRows.update((rows) =>
      rows.map((r) => {
        if (!shownIds.has(r.subMenuId)) return r;
        if (!this.canTouch(r, field) && target) return r; // can't force Add/Edit/Delete on without View
        const next = { ...r, [field]: target };
        if (field === 'canView' && !target) {
          next.canAdd = false;
          next.canEdit = false;
          next.canDelete = false;
        }
        return next;
      }),
    );
  }

  allowShown(): void {
    const shownIds = new Set(this.shownRows().map((r) => r.subMenuId));
    this.matrixRows.update((rows) => rows.map((r) => (shownIds.has(r.subMenuId) ? { ...r, canView: true, canAdd: true, canEdit: true, canDelete: true } : r)));
  }

  clearShown(): void {
    const shownIds = new Set(this.shownRows().map((r) => r.subMenuId));
    this.matrixRows.update((rows) => rows.map((r) => (shownIds.has(r.subMenuId) ? { ...r, canView: false, canAdd: false, canEdit: false, canDelete: false } : r)));
  }

  reload(): void {
    const roleId = this.selectedRoleId();
    if (roleId) this.doSelectRole(roleId);
  }

  saveChanges(): void {
    const roleId = this.selectedRoleId();
    const changes = this.changedRows();
    if (!roleId || changes.length === 0 || this.saving()) return;

    this.saving.set(true);
    const payload = {
      roleId,
      changes: changes.map((r) => ({
        subMenuId: r.subMenuId,
        roleRightId: r.roleRightId,
        canView: r.canView,
        canAdd: r.canAdd,
        canEdit: r.canEdit,
        canDelete: r.canDelete,
        originalIsActive: r.isActive,
        originalCanView: r.originalCanView,
        originalCanAdd: r.originalCanAdd,
        originalCanEdit: r.originalCanEdit,
        originalCanDelete: r.originalCanDelete,
      })),
      remarks: null,
    };

    this.api.post<typeof payload, { changedCount?: number; message?: string }>('admin/rolerights/save-batch', payload).subscribe({
      next: (res) => {
        this.saving.set(false);
        if (res.success) {
          this.toast.show(`${res.data?.changedCount ?? changes.length} permission change(s) saved.`);
          this.reload(); // re-fetch from the server — see Phase 5's own "reload and verify saved permissions"
        } else {
          this.toast.show(res.message || 'Failed to save permission changes.', 'error');
          this.saving.set(false);
        }
      },
      error: () => {
        this.saving.set(false);
        this.toast.show('Something went wrong while saving permission changes.', 'error');
      },
    });
  }

  openHistory(row: MatrixRow): void {
    if (!row.roleRightId) return;
    this.dialog.open<MasterViewHistoryDialogComponent, MasterViewHistoryDialogData>(MasterViewHistoryDialogComponent, {
      width: '640px',
      maxWidth: '94vw',
      data: {
        config: ROLERIGHTS_CONFIG,
        row: {
          roleRightId: row.roleRightId,
          roleId: this.selectedRoleId(),
          subMenuId: row.subMenuId,
          canView: row.canView,
          canAdd: row.canAdd,
          canEdit: row.canEdit,
          canDelete: row.canDelete,
          remarks: null,
        },
      },
    });
  }
}
