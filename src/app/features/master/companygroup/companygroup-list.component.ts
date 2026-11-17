import { Component, computed, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DialogService } from '../../../shared/ui/dialog/dialog.service';
import { MenuService } from '../../../core/services/menu.service';
import { MasterApiService } from '../shared/master-api.service';
import { COMPANYGROUP_CONFIG } from './companygroup.config';
import { CompanyGroupRow } from './companygroup.model';
import { CompanyGroupFormDialogComponent, CompanyGroupFormDialogData, CompanyGroupFormDialogResult } from './companygroup-form-dialog.component';
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

// Dedicated — not MasterListComponent-driven, but for a DIFFERENT reason
// than every other location Master this session: Company Group has no
// cascading dropdowns at all (it's a genuinely flat Code/Name/Remarks
// entity, confirmed live). The mismatch here is in the generic dialog's
// own fixed chrome — MasterFormDialogComponent hardcodes "Close"/"Save"
// button labels, has no subtitle line and no footer helper-text line at
// all (see master-form-dialog.component.html) — while this task requires
// an exact subtitle ("Enter Company Group details. Fields marked * are
// required."), a footer helper line, "Cancel"/"Save Company Group"
// button labels, and an Edit-mode-specific "Update Company Group" label.
// The two-column-then-full-row FIELD LAYOUT itself would actually have
// worked fine through the generic dialog (its own grid already lays out
// non-fullRow fields side by side and fullRow ones full-width) — only the
// header/footer copy forced a dedicated dialog here.
// COMPANYGROUP_CONFIG is kept and reused ONLY for the "View / History"
// action via the existing MasterViewHistoryDialogComponent.
@Component({
  selector: 'app-companygroup-list',
  standalone: true,
  imports: [FormsModule, ButtonComponent, SelectComponent, PaginationComponent, EmptyStateComponent, IconComponent],
  templateUrl: './companygroup-list.component.html',
  styleUrl: './companygroup-list.component.scss',
})
export class CompanyGroupListComponent {
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

  private readonly allRows = signal<CompanyGroupRow[]>([]);
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
  protected readonly selectedRow = signal<CompanyGroupRow | null>(null);
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
    this.masterApi.get<Record<string, unknown>, CompanyGroupRow>('master/companygroup', { searchText: this.searchText || null, isActive: null }).subscribe({
      next: (rows) => {
        this.loading.set(false);
        this.allRows.set(rows);
        this.page.set(1);
        this.statusMessage.set('Company groups loaded successfully.');
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

  selectRow(row: CompanyGroupRow): void {
    const current = this.selectedRow();
    this.selectedRow.set(current && current.companyGroupId === row.companyGroupId ? null : row);
  }

  protected isSelected(row: CompanyGroupRow): boolean {
    return this.selectedRow()?.companyGroupId === row.companyGroupId;
  }

  onPageChange(page: number): void {
    this.page.set(page);
  }

  openAdd(): void {
    this.dialog
      .open<CompanyGroupFormDialogComponent, CompanyGroupFormDialogData, CompanyGroupFormDialogResult>(CompanyGroupFormDialogComponent, {
        width: '560px',
        maxWidth: '94vw',
        data: { row: null, mode: 'add' },
      })
      .afterClosed()
      .subscribe((saved) => {
        if (saved) {
          this.loadList();
          this.toast.show('Company group added.');
        }
      });
  }

  openEdit(): void {
    const row = this.selectedRow();
    if (!row) return;
    this.dialog
      .open<CompanyGroupFormDialogComponent, CompanyGroupFormDialogData, CompanyGroupFormDialogResult>(CompanyGroupFormDialogComponent, {
        width: '560px',
        maxWidth: '94vw',
        data: { row, mode: 'edit' },
      })
      .afterClosed()
      .subscribe((saved) => {
        if (saved) {
          this.loadList();
          this.toast.show('Company group updated.');
        }
      });
  }

  openViewHistory(): void {
    const row = this.selectedRow();
    if (!row) return;
    this.dialog.open<MasterViewHistoryDialogComponent, MasterViewHistoryDialogData>(MasterViewHistoryDialogComponent, {
      width: '640px',
      maxWidth: '94vw',
      data: { config: COMPANYGROUP_CONFIG, row: row as unknown as Record<string, unknown> },
    });
  }

  deleteRow(): void {
    const row = this.selectedRow();
    if (!row) return;
    this.dialog
      .open(ConfirmDialogComponent, {
        width: '420px',
        data: {
          title: 'Delete Company Group',
          message: `This will deactivate "${row.companyGroupName}" and remove it from the active list. Its history is preserved, but it won't be reachable from this screen afterward. This action is not reversible from this screen.`,
        },
      })
      .afterClosed()
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.masterApi.delete('master/companygroup', { companyGroupId: row.companyGroupId }).subscribe({
          next: (res) => {
            if (res.success) {
              this.loadList();
              this.toast.show('Company group deactivated.');
            } else {
              this.toast.show(res.message || 'Failed to deactivate this company group.', 'error');
            }
          },
          error: () => this.toast.show('Something went wrong while deactivating this company group.', 'error'),
        });
      });
  }
}
