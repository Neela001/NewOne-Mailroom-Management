import { Component, computed, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DialogService } from '../../../shared/ui/dialog/dialog.service';
import { MenuService } from '../../../core/services/menu.service';
import { DeskService } from './desk.service';
import { DeskRow } from './desk.model';
import { DESK_CONFIG } from './desk.config';
import { DeskFormDialogComponent, DeskFormDialogData } from './desk-form-dialog.component';
import { MasterViewHistoryDialogComponent, MasterViewHistoryDialogData } from '../../master/shared/master-view-history-dialog.component';
import { ConfirmDialogComponent } from '../../master/shared/confirm-dialog.component';
import { ButtonComponent } from '../../../shared/ui/button/button.component';
import { SelectComponent, SelectOption } from '../../../shared/ui/form/select.component';
import { PaginationComponent } from '../../../shared/ui/pagination/pagination.component';
import { EmptyStateComponent } from '../../../shared/ui/empty-state/empty-state.component';
import { IconComponent } from '../../../shared/ui/icon/icon.component';
import { ToastService } from '../../../shared/ui/toast/toast.service';

type ActiveFilter = 'active' | 'inactive';
// Exactly 2 options — no "All" — per this task's own explicit spec
// ("Status – Dropdown (Active / Inactive)"), unlike every other entity's
// own 3-option Active/Inactive/All toolbar filter.
const ACTIVE_FILTER_OPTIONS: SelectOption[] = [
  { label: 'Active', value: 'active' },
  { label: 'Inactive', value: 'inactive' },
];

// Desk's own list screen — see desk.model.ts's own comment for why Desk
// is a dedicated feature rather than routed through the generic
// MasterListComponent. DESK_CONFIG is kept and reused only for the
// "View / History" action via the existing MasterViewHistoryDialogComponent.
@Component({
  selector: 'app-desk-list',
  standalone: true,
  imports: [FormsModule, ButtonComponent, SelectComponent, PaginationComponent, EmptyStateComponent, IconComponent],
  templateUrl: './desk-list.component.html',
  styleUrl: './desk-list.component.scss',
})
export class DeskListComponent {
  private readonly deskService = inject(DeskService);
  protected readonly menuService = inject(MenuService);
  private readonly dialog = inject(DialogService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  protected readonly loading = signal(false);
  protected readonly skeletonRows = [1, 2, 3, 4, 5];
  protected readonly headerIcon = computed(() => this.menuService.findIconForRoute(this.router.url) ?? 'briefcase');
  protected readonly activeFilterOptions = ACTIVE_FILTER_OPTIONS;
  protected readonly activeFilter = signal<ActiveFilter>('active');

  private readonly allRows = signal<DeskRow[]>([]);
  protected readonly rows = computed(() => {
    const filter = this.activeFilter();
    return this.allRows().filter((r) => r.isActive === (filter === 'active'));
  });

  protected readonly pageSize = 10;
  protected readonly page = signal(1);
  protected readonly pagedRows = computed(() => {
    const start = (this.page() - 1) * this.pageSize;
    return this.rows().slice(start, start + this.pageSize);
  });

  protected readonly searchDisplay = signal('');
  private searchText = '';
  protected readonly selectedRow = signal<DeskRow | null>(null);
  protected readonly statusMessage = signal<string | null>(null);
  protected readonly rights = signal({ canView: true, canAdd: false, canEdit: false, canDelete: false });
  private hasFetchedList = false;

  constructor() {
    // Same reactive-rights fix as MasterListComponent's own constructor
    // comment — this component mounts at the same time as SidenavComponent
    // kicks off the real admin/user-rights/me fetch, not after it resolves.
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
    this.deskService.get({ searchText: this.searchText || null, isActive: null }).subscribe({
      next: (rows) => {
        this.loading.set(false);
        this.allRows.set(rows);
        this.page.set(1);
        this.statusMessage.set('Desks data loaded successfully.');
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

  selectRow(row: DeskRow): void {
    const current = this.selectedRow();
    this.selectedRow.set(current && current.deskId === row.deskId ? null : row);
  }

  protected isSelected(row: DeskRow): boolean {
    return this.selectedRow()?.deskId === row.deskId;
  }

  onPageChange(page: number): void {
    this.page.set(page);
  }

  openAdd(): void {
    this.dialog
      .open<DeskFormDialogComponent, DeskFormDialogData, boolean>(DeskFormDialogComponent, {
        width: '880px',
        maxWidth: '96vw',
        data: { row: null, mode: 'add' },
      })
      .afterClosed()
      .subscribe((saved) => {
        if (saved) {
          this.loadList();
          this.toast.show('Desk added.');
        }
      });
  }

  openEdit(): void {
    const row = this.selectedRow();
    if (!row) return;
    this.dialog
      .open<DeskFormDialogComponent, DeskFormDialogData, boolean>(DeskFormDialogComponent, {
        width: '880px',
        maxWidth: '96vw',
        data: { row, mode: 'edit' },
      })
      .afterClosed()
      .subscribe((saved) => {
        if (saved) {
          this.loadList();
          this.toast.show('Desk updated.');
        }
      });
  }

  openViewHistory(): void {
    const row = this.selectedRow();
    if (!row) return;
    this.dialog.open<MasterViewHistoryDialogComponent, MasterViewHistoryDialogData>(MasterViewHistoryDialogComponent, {
      width: '640px',
      maxWidth: '94vw',
      data: { config: DESK_CONFIG, row: row as unknown as Record<string, unknown> },
    });
  }

  deleteRow(): void {
    const row = this.selectedRow();
    if (!row) return;
    this.dialog
      .open(ConfirmDialogComponent, {
        width: '420px',
        data: {
          title: 'Delete Desk',
          message: `Are you sure you want to delete "${row.deskName}"? Like other records in this system, this deactivates it rather than permanently removing it.`,
        },
      })
      .afterClosed()
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.deskService.delete({ deskId: row.deskId }).subscribe({
          next: (res) => {
            if (res.success) {
              this.loadList();
              this.toast.show('Desk deactivated.');
            } else {
              this.toast.show(res.message || 'Failed to deactivate this desk.', 'error');
            }
          },
          error: () => this.toast.show('Something went wrong while deactivating this desk.', 'error'),
        });
      });
  }
}
