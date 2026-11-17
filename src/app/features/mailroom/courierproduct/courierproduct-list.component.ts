import { Component, computed, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DialogService } from '../../../shared/ui/dialog/dialog.service';
import { MenuService } from '../../../core/services/menu.service';
import { MasterApiService } from '../../master/shared/master-api.service';
import { COURIERPRODUCT_CONFIG } from './courierproduct.config';
import { CourierProductRow } from './courierproduct.model';
import { CourierProductFormDialogComponent, CourierProductFormDialogData, CourierProductFormDialogResult } from './courierproduct-form-dialog.component';
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
const ALL_SERVICES_VALUE = '';

// Confirmed-live real values only — no fixed enum/options source exists
// for this field; see couriervendor.config.ts's own comment.
const SERVICE_TYPE_LABELS: Record<string, string> = { DOMESTIC: 'Domestic', BOTH: 'Both' };

// Dedicated — not MasterListComponent-driven. Courier Product's own
// Add/Edit has a genuine Mode -> Vendor -> Service Type cascade with no
// shape in the generic formFields model (Service Type is derived from
// the selected Vendor, not independently browsable), plus a real
// business-rule-level Volumetric Divisor validation the generic numeric
// field type doesn't express. See courierproduct.model.ts's own
// confirmed-live API writeup. COURIERPRODUCT_CONFIG is kept and reused
// here ONLY for the "View / History" action.
@Component({
  selector: 'app-courierproduct-list',
  standalone: true,
  imports: [FormsModule, ButtonComponent, SelectComponent, PaginationComponent, EmptyStateComponent, IconComponent],
  templateUrl: './courierproduct-list.component.html',
  styleUrl: './courierproduct-list.component.scss',
})
export class CourierProductListComponent {
  private readonly masterApi = inject(MasterApiService);
  protected readonly menuService = inject(MenuService);
  private readonly dialog = inject(DialogService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  protected readonly loading = signal(false);
  protected readonly skeletonRows = [1, 2, 3, 4, 5];
  protected readonly headerIcon = computed(() => this.menuService.findIconForRoute(this.router.url) ?? 'package');
  protected readonly activeFilterOptions = ACTIVE_FILTER_OPTIONS;
  protected readonly activeFilter = signal<ActiveFilter>('active');

  // "All services" first, per this task's own explicit requirement —
  // built from the DISTINCT real serviceType values currently present in
  // the loaded list (confirmed-live values, not a hardcoded enum — no
  // backend options source exists for this field independent of a
  // Vendor; see courierproduct.model.ts's own comment).
  protected readonly serviceFilter = signal<string>(ALL_SERVICES_VALUE);
  protected readonly serviceFilterOptions = computed<SelectOption[]>(() => {
    const distinct = Array.from(new Set(this.allRows().map((r) => r.serviceType).filter((v): v is string => !!v)));
    return [{ label: 'All services', value: ALL_SERVICES_VALUE }, ...distinct.map((v) => ({ label: SERVICE_TYPE_LABELS[v] ?? v, value: v }))];
  });

  private readonly allRows = signal<CourierProductRow[]>([]);
  protected readonly rows = computed(() => {
    const filter = this.activeFilter();
    const service = this.serviceFilter();
    return this.allRows()
      .filter((r) => (filter === 'all' ? true : r.isActive === (filter === 'active')))
      .filter((r) => (service ? r.serviceType === service : true));
  });

  protected readonly pageSize = 10;
  protected readonly page = signal(1);
  protected readonly pagedRows = computed(() => {
    const start = (this.page() - 1) * this.pageSize;
    return this.rows().slice(start, start + this.pageSize);
  });

  protected readonly searchDisplay = signal('');
  private searchText = '';
  protected readonly selectedRow = signal<CourierProductRow | null>(null);
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
    this.masterApi.get<Record<string, unknown>, CourierProductRow>('master/courierproduct', { searchText: this.searchText || null, isActive: null }).subscribe({
      next: (rows) => {
        this.loading.set(false);
        this.allRows.set(rows);
        this.page.set(1);
        this.statusMessage.set('Courier products loaded successfully.');
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

  selectRow(row: CourierProductRow): void {
    const current = this.selectedRow();
    this.selectedRow.set(current && current.courierProductId === row.courierProductId ? null : row);
  }

  protected isSelected(row: CourierProductRow): boolean {
    return this.selectedRow()?.courierProductId === row.courierProductId;
  }

  protected serviceTypeDisplay(row: CourierProductRow): string {
    return (row.serviceType && SERVICE_TYPE_LABELS[row.serviceType]) || row.serviceType || '—';
  }

  onPageChange(page: number): void {
    this.page.set(page);
  }

  onServiceFilterChange(value: string): void {
    this.serviceFilter.set(value);
    this.page.set(1);
  }

  openAdd(): void {
    this.dialog
      .open<CourierProductFormDialogComponent, CourierProductFormDialogData, CourierProductFormDialogResult>(CourierProductFormDialogComponent, {
        width: '680px',
        maxWidth: '94vw',
        data: { row: null, mode: 'add' },
      })
      .afterClosed()
      .subscribe((saved) => {
        if (saved) {
          this.loadList();
          this.toast.show('Courier product added.');
        }
      });
  }

  openEdit(): void {
    const row = this.selectedRow();
    if (!row) return;
    this.dialog
      .open<CourierProductFormDialogComponent, CourierProductFormDialogData, CourierProductFormDialogResult>(CourierProductFormDialogComponent, {
        width: '680px',
        maxWidth: '94vw',
        data: { row, mode: 'edit' },
      })
      .afterClosed()
      .subscribe((saved) => {
        if (saved) {
          this.loadList();
          this.toast.show('Courier product updated.');
        }
      });
  }

  openViewHistory(): void {
    const row = this.selectedRow();
    if (!row) return;
    this.dialog.open<MasterViewHistoryDialogComponent, MasterViewHistoryDialogData>(MasterViewHistoryDialogComponent, {
      width: '680px',
      maxWidth: '94vw',
      data: { config: COURIERPRODUCT_CONFIG, row: row as unknown as Record<string, unknown> },
    });
  }

  deleteRow(): void {
    const row = this.selectedRow();
    if (!row) return;
    this.dialog
      .open(ConfirmDialogComponent, {
        width: '420px',
        data: {
          title: 'Delete Courier Product',
          message: `This will deactivate "${row.name}" and remove it from the active list. Its history is preserved, but it won't be reachable from this screen afterward. This action is not reversible from this screen.`,
        },
      })
      .afterClosed()
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.masterApi.delete('master/courierproduct', { courierProductId: row.courierProductId }).subscribe({
          next: (res) => {
            if (res.success) {
              this.loadList();
              this.toast.show('Courier product deactivated.');
            } else {
              // Surfaces the real backend message verbatim — e.g. a real
              // dependency-restriction rejection if one exists (this
              // task's own "Follow actual backend deletion rules"
              // instruction; never assumed/invented here).
              this.toast.show(res.message || 'Failed to deactivate this courier product.', 'error');
            }
          },
          error: () => this.toast.show('Something went wrong while deactivating this courier product.', 'error'),
        });
      });
  }
}
