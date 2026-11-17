import { Component, computed, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DialogService } from '../../../shared/ui/dialog/dialog.service';
import { MenuService } from '../../../core/services/menu.service';
import { MasterApiService } from '../shared/master-api.service';
import { STATE_CONFIG } from './state.config';
import { StateRow } from './state.model';
import { StateFormDialogComponent, StateFormDialogData, StateFormDialogResult } from './state-form-dialog.component';
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

// Dedicated — not MasterListComponent-driven. Same reasoning as Country
// Master's own rebuild this session: the real Windows reference's own
// Add/Edit popup (a Country dropdown filtered to active, State-enabled
// countries only, combined "Name (Code)" labels, a bordered panel, custom
// subtitle/footer helper text/button labels) has no shape in the generic
// formFields model, and the list page's own single-row toolbar (Refresh/
// Add/Edit/Delete/View History together, not Add separated into the
// header) doesn't match MasterListComponent's own layout either — see
// state-form-dialog.component.ts's own comment for the dropdown filtering
// logic. STATE_CONFIG is kept and reused here ONLY for the "View / History"
// action via the existing MasterViewHistoryDialogComponent.
@Component({
  selector: 'app-state-list',
  standalone: true,
  imports: [FormsModule, ButtonComponent, SelectComponent, PaginationComponent, EmptyStateComponent, IconComponent],
  templateUrl: './state-list.component.html',
  styleUrl: './state-list.component.scss',
})
export class StateListComponent {
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

  private readonly allRows = signal<StateRow[]>([]);
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
  protected readonly selectedRow = signal<StateRow | null>(null);
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
    this.masterApi.get<Record<string, unknown>, StateRow>('master/state', { searchText: this.searchText || null, isActive: null }).subscribe({
      next: (rows) => {
        this.loading.set(false);
        this.allRows.set(rows);
        this.page.set(1);
        this.statusMessage.set('States loaded successfully.');
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

  selectRow(row: StateRow): void {
    const current = this.selectedRow();
    this.selectedRow.set(current && current.stateId === row.stateId ? null : row);
  }

  protected isSelected(row: StateRow): boolean {
    return this.selectedRow()?.stateId === row.stateId;
  }

  onPageChange(page: number): void {
    this.page.set(page);
  }

  openAdd(): void {
    this.dialog
      .open<StateFormDialogComponent, StateFormDialogData, StateFormDialogResult>(StateFormDialogComponent, {
        width: '680px',
        maxWidth: '94vw',
        data: { row: null, mode: 'add' },
      })
      .afterClosed()
      .subscribe((saved) => {
        if (saved) {
          this.loadList();
          this.toast.show('State added.');
        }
      });
  }

  openEdit(): void {
    const row = this.selectedRow();
    if (!row) return;
    this.dialog
      .open<StateFormDialogComponent, StateFormDialogData, StateFormDialogResult>(StateFormDialogComponent, {
        width: '680px',
        maxWidth: '94vw',
        data: { row, mode: 'edit' },
      })
      .afterClosed()
      .subscribe((saved) => {
        if (saved) {
          this.loadList();
          this.toast.show('State updated.');
        }
      });
  }

  openViewHistory(): void {
    const row = this.selectedRow();
    if (!row) return;
    this.dialog.open<MasterViewHistoryDialogComponent, MasterViewHistoryDialogData>(MasterViewHistoryDialogComponent, {
      width: '640px',
      maxWidth: '94vw',
      data: { config: STATE_CONFIG, row: row as unknown as Record<string, unknown> },
    });
  }

  deleteRow(): void {
    const row = this.selectedRow();
    if (!row) return;
    this.dialog
      .open(ConfirmDialogComponent, {
        width: '420px',
        data: {
          title: 'Delete State',
          message: `This will deactivate "${row.stateName}" and remove it from the active list. Its history is preserved, but it won't be reachable from this screen afterward. This action is not reversible from this screen.`,
        },
      })
      .afterClosed()
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.masterApi.delete('master/state', { stateId: row.stateId }).subscribe({
          next: (res) => {
            if (res.success) {
              this.loadList();
              this.toast.show('State deactivated.');
            } else {
              this.toast.show(res.message || 'Failed to deactivate this state.', 'error');
            }
          },
          error: () => this.toast.show('Something went wrong while deactivating this state.', 'error'),
        });
      });
  }
}
