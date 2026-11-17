import { Component, computed, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DialogService } from '../../../shared/ui/dialog/dialog.service';
import { MenuService } from '../../../core/services/menu.service';
import { MasterApiService } from '../shared/master-api.service';
import { DESIGNATION_CONFIG } from './designation.config';
import { DesignationRow } from './designation.model';
import { DesignationFormDialogComponent, DesignationFormDialogData, DesignationFormDialogResult } from './designation-form-dialog.component';
import { MasterViewHistoryDialogComponent, MasterViewHistoryDialogData } from '../shared/master-view-history-dialog.component';
import { ConfirmDialogComponent } from '../shared/confirm-dialog.component';
import { ButtonComponent } from '../../../shared/ui/button/button.component';
import { SelectComponent, SelectOption } from '../../../shared/ui/form/select.component';
import { PaginationComponent } from '../../../shared/ui/pagination/pagination.component';
import { EmptyStateComponent } from '../../../shared/ui/empty-state/empty-state.component';
import { IconComponent } from '../../../shared/ui/icon/icon.component';
import { ToastService } from '../../../shared/ui/toast/toast.service';

type ActiveFilter = 'active' | 'inactive' | 'all';
const ACTIVE_FILTER_OPTIONS: SelectOption[] = [
  { label: 'Active', value: 'active' },
  { label: 'Inactive', value: 'inactive' },
  { label: 'All', value: 'all' },
];

// Dedicated — not MasterListComponent-driven. Same "generic dialog chrome
// mismatch" reasoning as Cost Center/Division/Department Master's own
// rebuilds this session (single-level Company dependency, not a
// cascading one): the generic dialog has no subtitle, no footer
// helper-text line, hardcoded "Close"/"Save" button labels, while this
// task requires an exact subtitle, footer helper text, "Cancel"/"Save
// Designation" button labels, AND a "Specify level" checkbox the generic
// field-rendering loop has no concept of. DESIGNATION_CONFIG is kept and
// reused here ONLY for the "View / History" action via the existing
// MasterViewHistoryDialogComponent.
@Component({
  selector: 'app-designation-list',
  standalone: true,
  imports: [FormsModule, ButtonComponent, SelectComponent, PaginationComponent, EmptyStateComponent, IconComponent],
  templateUrl: './designation-list.component.html',
  styleUrl: './designation-list.component.scss',
})
export class DesignationListComponent {
  private readonly masterApi = inject(MasterApiService);
  protected readonly menuService = inject(MenuService);
  private readonly dialog = inject(DialogService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  protected readonly loading = signal(false);
  protected readonly skeletonRows = [1, 2, 3, 4, 5];
  protected readonly headerIcon = computed(() => this.menuService.findIconForRoute(this.router.url) ?? 'badge');
  protected readonly activeFilterOptions = ACTIVE_FILTER_OPTIONS;
  protected readonly activeFilter = signal<ActiveFilter>('active');

  private readonly allRows = signal<DesignationRow[]>([]);
  protected readonly rows = computed(() => {
    const filter = this.activeFilter();
    return filter === 'all' ? this.allRows() : this.allRows().filter((r) => r.isActive === (filter === 'active'));
  });

  protected readonly pageSize = 10;
  protected readonly page = signal(1);
  protected readonly pagedRows = computed(() => {
    const start = (this.page() - 1) * this.pageSize;
    return this.rows().slice(start, start + this.pageSize);
  });

  protected readonly searchDisplay = signal('');
  private searchText = '';
  protected readonly selectedRow = signal<DesignationRow | null>(null);
  protected readonly statusMessage = signal<string | null>(null);
  protected readonly rights = signal({ canView: true, canAdd: false, canEdit: false, canDelete: false });
  private hasFetchedList = false;

  constructor() {
    effect(() => {
      if (!this.menuService.hasLoaded()) return;
      const found = this.menuService.findRightsForRoute(this.router.url);
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
    this.masterApi.get<Record<string, unknown>, DesignationRow>('master/designation', { searchText: this.searchText || null, isActive: null }).subscribe({
      next: (rows) => {
        this.loading.set(false);
        this.allRows.set(rows);
        this.page.set(1);
        this.statusMessage.set('Designations loaded successfully.');
      },
      error: () => {
        this.loading.set(false);
        this.allRows.set([]);
        this.page.set(1);
        this.statusMessage.set(null);
      },
    });
  }

  search(): void {
    this.searchText = this.searchDisplay().trim();
    this.loadList();
  }

  refresh(): void {
    this.loadList();
  }

  selectRow(row: DesignationRow): void {
    const current = this.selectedRow();
    this.selectedRow.set(current && current.designationId === row.designationId ? null : row);
  }

  protected isSelected(row: DesignationRow): boolean {
    return this.selectedRow()?.designationId === row.designationId;
  }

  // Displays null distinctly from a real 0 — CONFIRMED LIVE they are
  // different backend states (designation.model.ts's own class-level
  // comment); a real 0 must read as "0", never blank/"—".
  protected levelDisplay(row: DesignationRow): string {
    return row.designationLevel != null ? String(row.designationLevel) : '—';
  }

  onPageChange(page: number): void {
    this.page.set(page);
  }

  openAdd(): void {
    this.dialog
      .open<DesignationFormDialogComponent, DesignationFormDialogData, DesignationFormDialogResult>(DesignationFormDialogComponent, {
        width: '560px',
        maxWidth: '94vw',
        data: { row: null, mode: 'add' },
      })
      .afterClosed()
      .subscribe((saved) => {
        if (saved) {
          this.loadList();
          this.toast.show('Designation added.');
        }
      });
  }

  openEdit(): void {
    const row = this.selectedRow();
    if (!row) return;
    this.dialog
      .open<DesignationFormDialogComponent, DesignationFormDialogData, DesignationFormDialogResult>(DesignationFormDialogComponent, {
        width: '560px',
        maxWidth: '94vw',
        data: { row, mode: 'edit' },
      })
      .afterClosed()
      .subscribe((saved) => {
        if (saved) {
          this.loadList();
          this.toast.show('Designation updated.');
        }
      });
  }

  openViewHistory(): void {
    const row = this.selectedRow();
    if (!row) return;
    this.dialog.open<MasterViewHistoryDialogComponent, MasterViewHistoryDialogData>(MasterViewHistoryDialogComponent, {
      width: '640px',
      maxWidth: '94vw',
      data: { config: DESIGNATION_CONFIG, row: row as unknown as Record<string, unknown> },
    });
  }

  deleteRow(): void {
    const row = this.selectedRow();
    if (!row) return;
    this.dialog
      .open(ConfirmDialogComponent, {
        width: '420px',
        data: {
          title: 'Delete Designation',
          message: `This will deactivate "${row.designationName}" and remove it from the active list. Its history is preserved, but it won't be reachable from this screen afterward. This action is not reversible from this screen.`,
        },
      })
      .afterClosed()
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.masterApi.delete('master/designation', { designationId: row.designationId }).subscribe({
          next: (res) => {
            if (res.success) {
              this.loadList();
              this.toast.show('Designation deactivated.');
            } else {
              this.toast.show(res.message || 'Failed to deactivate this designation.', 'error');
            }
          },
          error: () => this.toast.show('Something went wrong while deactivating this designation.', 'error'),
        });
      });
  }
}
