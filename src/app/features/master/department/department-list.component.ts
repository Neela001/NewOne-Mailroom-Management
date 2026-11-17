import { Component, computed, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DialogService } from '../../../shared/ui/dialog/dialog.service';
import { MenuService } from '../../../core/services/menu.service';
import { MasterApiService } from '../shared/master-api.service';
import { DEPARTMENT_CONFIG } from './department.config';
import { DepartmentRow } from './department.model';
import { DepartmentFormDialogComponent, DepartmentFormDialogData, DepartmentFormDialogResult } from './department-form-dialog.component';
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

// Dedicated — not MasterListComponent-driven. The real Windows
// reference's own Add Department popup (a Company -> Division
// dependency, where Division is disabled until a valid Company is
// selected and loaded client-side filtered to that Company, plus the
// same generic-dialog-chrome mismatch — no subtitle, no footer helper
// text, hardcoded "Close"/"Save" labels — as Company Group/Company/
// Division Master's own rebuilds this session) has no shape in the
// generic formFields model. See department-form-dialog.component.ts's
// own comment for the full dependency logic. DEPARTMENT_CONFIG is kept
// and reused here ONLY for the "View / History" action via the existing
// MasterViewHistoryDialogComponent.
@Component({
  selector: 'app-department-list',
  standalone: true,
  imports: [FormsModule, ButtonComponent, SelectComponent, PaginationComponent, EmptyStateComponent, IconComponent],
  templateUrl: './department-list.component.html',
  styleUrl: './department-list.component.scss',
})
export class DepartmentListComponent {
  private readonly masterApi = inject(MasterApiService);
  protected readonly menuService = inject(MenuService);
  private readonly dialog = inject(DialogService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  protected readonly loading = signal(false);
  protected readonly skeletonRows = [1, 2, 3, 4, 5];
  protected readonly headerIcon = computed(() => this.menuService.findIconForRoute(this.router.url) ?? 'landmark');
  protected readonly activeFilterOptions = ACTIVE_FILTER_OPTIONS;
  protected readonly activeFilter = signal<ActiveFilter>('active');

  private readonly allRows = signal<DepartmentRow[]>([]);
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
  protected readonly selectedRow = signal<DepartmentRow | null>(null);
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
    this.masterApi.get<Record<string, unknown>, DepartmentRow>('master/department', { searchText: this.searchText || null, isActive: null }).subscribe({
      next: (rows) => {
        this.loading.set(false);
        this.allRows.set(rows);
        this.page.set(1);
        this.statusMessage.set('Departments loaded successfully.');
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

  selectRow(row: DepartmentRow): void {
    const current = this.selectedRow();
    this.selectedRow.set(current && current.departmentId === row.departmentId ? null : row);
  }

  protected isSelected(row: DepartmentRow): boolean {
    return this.selectedRow()?.departmentId === row.departmentId;
  }

  onPageChange(page: number): void {
    this.page.set(page);
  }

  openAdd(): void {
    this.dialog
      .open<DepartmentFormDialogComponent, DepartmentFormDialogData, DepartmentFormDialogResult>(DepartmentFormDialogComponent, {
        width: '620px',
        maxWidth: '94vw',
        data: { row: null, mode: 'add' },
      })
      .afterClosed()
      .subscribe((saved) => {
        if (saved) {
          this.loadList();
          this.toast.show('Department added.');
        }
      });
  }

  openEdit(): void {
    const row = this.selectedRow();
    if (!row) return;
    this.dialog
      .open<DepartmentFormDialogComponent, DepartmentFormDialogData, DepartmentFormDialogResult>(DepartmentFormDialogComponent, {
        width: '620px',
        maxWidth: '94vw',
        data: { row, mode: 'edit' },
      })
      .afterClosed()
      .subscribe((saved) => {
        if (saved) {
          this.loadList();
          this.toast.show('Department updated.');
        }
      });
  }

  openViewHistory(): void {
    const row = this.selectedRow();
    if (!row) return;
    this.dialog.open<MasterViewHistoryDialogComponent, MasterViewHistoryDialogData>(MasterViewHistoryDialogComponent, {
      width: '640px',
      maxWidth: '94vw',
      data: { config: DEPARTMENT_CONFIG, row: row as unknown as Record<string, unknown> },
    });
  }

  deleteRow(): void {
    const row = this.selectedRow();
    if (!row) return;
    this.dialog
      .open(ConfirmDialogComponent, {
        width: '420px',
        data: {
          title: 'Delete Department',
          message: `This will deactivate "${row.departmentName}" and remove it from the active list. Its history is preserved, but it won't be reachable from this screen afterward. This action is not reversible from this screen.`,
        },
      })
      .afterClosed()
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.masterApi.delete('master/department', { departmentId: row.departmentId }).subscribe({
          next: (res) => {
            if (res.success) {
              this.loadList();
              this.toast.show('Department deactivated.');
            } else {
              this.toast.show(res.message || 'Failed to deactivate this department.', 'error');
            }
          },
          error: () => this.toast.show('Something went wrong while deactivating this department.', 'error'),
        });
      });
  }
}
