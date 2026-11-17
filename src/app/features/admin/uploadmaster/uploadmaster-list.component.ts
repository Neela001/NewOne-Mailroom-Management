import { Component, computed, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DialogService } from '../../../shared/ui/dialog/dialog.service';
import { MenuService } from '../../../core/services/menu.service';
import { UploadMasterService } from './uploadmaster.service';
import { UploadDefinitionRow } from './uploadmaster.model';
import { UPLOADMASTER_CONFIG } from './uploadmaster.config';
import { UploadMasterFormDialogComponent, UploadMasterFormDialogData, UploadMasterFormDialogResult } from './uploadmaster-form-dialog.component';
import { MasterViewHistoryDialogComponent, MasterViewHistoryDialogData } from '../../master/shared/master-view-history-dialog.component';
import { ConfirmDialogComponent } from '../../master/shared/confirm-dialog.component';
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

// Upload Master's own dedicated list screen — NOT MasterListComponent-
// driven. See uploadmaster.model.ts's own comment for the real
// admin/upload-master/* endpoints this is built against, and
// uploadmaster-form-dialog.component.ts's own comment for why the
// Add/Edit popup (procedure-driven field dependency logic, a 2-tab
// Basic/XML layout structure) has no shape in the generic config model.
// UPLOADMASTER_CONFIG is kept and reused only for the "View / History"
// action via the existing MasterViewHistoryDialogComponent.
@Component({
  selector: 'app-uploadmaster-list',
  standalone: true,
  imports: [FormsModule, ButtonComponent, SelectComponent, PaginationComponent, EmptyStateComponent, IconComponent],
  templateUrl: './uploadmaster-list.component.html',
  styleUrl: './uploadmaster-list.component.scss',
})
export class UploadMasterListComponent {
  private readonly uploadMasterService = inject(UploadMasterService);
  protected readonly menuService = inject(MenuService);
  private readonly dialog = inject(DialogService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  protected readonly loading = signal(false);
  protected readonly skeletonRows = [1, 2, 3, 4, 5];
  protected readonly headerIcon = computed(() => this.menuService.findIconForRoute(this.router.url) ?? 'upload');
  protected readonly activeFilterOptions = ACTIVE_FILTER_OPTIONS;
  protected readonly activeFilter = signal<ActiveFilter>('active');

  private readonly allRows = signal<UploadDefinitionRow[]>([]);
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
  protected readonly selectedRow = signal<UploadDefinitionRow | null>(null);
  protected readonly statusMessage = signal<string | null>(null);
  protected readonly rights = signal({ canView: true, canAdd: false, canEdit: false, canDelete: false });
  private hasFetchedList = false;

  constructor() {
    // Same reactive-rights fix as every other dedicated list's own
    // constructor comment.
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
    this.uploadMasterService.get({ searchText: this.searchText || null, isActive: null }).subscribe({
      next: (rows) => {
        this.loading.set(false);
        this.allRows.set(rows);
        this.page.set(1);
        this.statusMessage.set('Upload definitions loaded successfully.');
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

  selectRow(row: UploadDefinitionRow): void {
    const current = this.selectedRow();
    this.selectedRow.set(current && current.uploadDefinitionId === row.uploadDefinitionId ? null : row);
  }

  protected isSelected(row: UploadDefinitionRow): boolean {
    return this.selectedRow()?.uploadDefinitionId === row.uploadDefinitionId;
  }

  onPageChange(page: number): void {
    this.page.set(page);
  }

  openAdd(): void {
    this.dialog
      .open<UploadMasterFormDialogComponent, UploadMasterFormDialogData, UploadMasterFormDialogResult>(UploadMasterFormDialogComponent, {
        width: '820px',
        maxWidth: '94vw',
        data: { row: null, mode: 'add' },
      })
      .afterClosed()
      .subscribe((saved) => {
        if (saved) {
          this.loadList();
          this.toast.show('Upload definition added.');
        }
      });
  }

  openEdit(): void {
    const row = this.selectedRow();
    if (!row) return;
    this.dialog
      .open<UploadMasterFormDialogComponent, UploadMasterFormDialogData, UploadMasterFormDialogResult>(UploadMasterFormDialogComponent, {
        width: '820px',
        maxWidth: '94vw',
        data: { row, mode: 'edit' },
      })
      .afterClosed()
      .subscribe((saved) => {
        if (saved) {
          this.loadList();
          this.toast.show('Upload definition updated.');
        }
      });
  }

  openViewHistory(): void {
    const row = this.selectedRow();
    if (!row) return;
    this.dialog.open<MasterViewHistoryDialogComponent, MasterViewHistoryDialogData>(MasterViewHistoryDialogComponent, {
      width: '640px',
      maxWidth: '94vw',
      data: { config: UPLOADMASTER_CONFIG, row: row as unknown as Record<string, unknown> },
    });
  }

  deleteRow(): void {
    const row = this.selectedRow();
    if (!row) return;
    this.dialog
      .open(ConfirmDialogComponent, {
        width: '420px',
        data: {
          title: 'Delete Upload Definition',
          message: `Are you sure you want to delete "${row.uploadName}"? Like other records in this system, this deactivates it rather than permanently removing it.`,
        },
      })
      .afterClosed()
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.uploadMasterService.delete(row.uploadDefinitionId).subscribe({
          next: (res) => {
            if (res.success) {
              this.loadList();
              this.toast.show('Upload definition deactivated.');
            } else {
              this.toast.show(res.message || 'Failed to deactivate this upload definition.', 'error');
            }
          },
          error: () => this.toast.show('Something went wrong while deactivating this upload definition.', 'error'),
        });
      });
  }
}
