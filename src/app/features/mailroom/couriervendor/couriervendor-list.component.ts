import { Component, computed, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DialogService } from '../../../shared/ui/dialog/dialog.service';
import { MenuService } from '../../../core/services/menu.service';
import { MasterApiService } from '../../master/shared/master-api.service';
import { COURIERVENDOR_CONFIG } from './couriervendor.config';
import { CourierVendorRow } from './couriervendor.model';
import { CourierVendorFormDialogComponent, CourierVendorFormDialogData, CourierVendorFormDialogResult } from './couriervendor-form-dialog.component';
import { CourierVendorViewDesksDialogComponent, CourierVendorViewDesksDialogData } from './couriervendor-view-desks-dialog.component';
import { CourierVendorViewContactsDialogComponent, CourierVendorViewContactsDialogData } from './couriervendor-view-contacts-dialog.component';
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

// Confirmed-live real values only — see couriervendor.model.ts's own
// class comment for why no backend enum/options source exists for
// either field.
const VENDOR_TYPE_LABELS: Record<string, string> = { BOTH: 'Both', INBOUND_ONLY: 'Inbound Only' };
const SERVICE_TYPE_LABELS: Record<string, string> = { DOMESTIC: 'Domestic', BOTH: 'Both' };

// Dedicated — not MasterListComponent-driven. Courier Vendor's own Add/
// Edit is a genuine 3-tab workflow (Vendor Details, Desks, Contacts)
// built on a dedicated combined-save API family with no shape in the
// generic formFields model whatsoever, plus two extra listing actions
// ("View Desks"/"View Contacts") the generic list has no concept of —
// see couriervendor-form-dialog.component.ts's own class-level comment
// and couriervendor.model.ts's own comment for the full confirmed-live
// API writeup. COURIERVENDOR_CONFIG is kept and reused here ONLY for the
// "View / History" action.
@Component({
  selector: 'app-couriervendor-list',
  standalone: true,
  imports: [FormsModule, ButtonComponent, SelectComponent, PaginationComponent, EmptyStateComponent, IconComponent],
  templateUrl: './couriervendor-list.component.html',
  styleUrl: './couriervendor-list.component.scss',
})
export class CourierVendorListComponent {
  private readonly masterApi = inject(MasterApiService);
  protected readonly menuService = inject(MenuService);
  private readonly dialog = inject(DialogService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  protected readonly loading = signal(false);
  protected readonly skeletonRows = [1, 2, 3, 4, 5];
  protected readonly headerIcon = computed(() => this.menuService.findIconForRoute(this.router.url) ?? 'truck');
  protected readonly activeFilterOptions = ACTIVE_FILTER_OPTIONS;
  protected readonly activeFilter = signal<ActiveFilter>('active');

  private readonly allRows = signal<CourierVendorRow[]>([]);
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
  protected readonly selectedRow = signal<CourierVendorRow | null>(null);
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
    this.masterApi.get<Record<string, unknown>, CourierVendorRow>('master/couriervendor', { searchText: this.searchText || null, isActive: null }).subscribe({
      next: (rows) => {
        this.loading.set(false);
        this.allRows.set(rows);
        this.page.set(1);
        this.statusMessage.set('Courier vendors loaded successfully.');
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

  selectRow(row: CourierVendorRow): void {
    const current = this.selectedRow();
    this.selectedRow.set(current && current.courierVendorId === row.courierVendorId ? null : row);
  }

  protected isSelected(row: CourierVendorRow): boolean {
    return this.selectedRow()?.courierVendorId === row.courierVendorId;
  }

  protected vendorTypeDisplay(row: CourierVendorRow): string {
    return (row.vendorType && VENDOR_TYPE_LABELS[row.vendorType]) || row.vendorType || '—';
  }

  protected serviceTypeDisplay(row: CourierVendorRow): string {
    return (row.serviceType && SERVICE_TYPE_LABELS[row.serviceType]) || row.serviceType || '—';
  }

  onPageChange(page: number): void {
    this.page.set(page);
  }

  openAdd(): void {
    this.dialog
      .open<CourierVendorFormDialogComponent, CourierVendorFormDialogData, CourierVendorFormDialogResult>(CourierVendorFormDialogComponent, {
        width: '900px',
        maxWidth: '96vw',
        data: { row: null, mode: 'add' },
      })
      .afterClosed()
      .subscribe((saved) => {
        if (saved) {
          this.loadList();
          this.toast.show('Courier vendor added.');
        }
      });
  }

  openEdit(): void {
    const row = this.selectedRow();
    if (!row) return;
    this.dialog
      .open<CourierVendorFormDialogComponent, CourierVendorFormDialogData, CourierVendorFormDialogResult>(CourierVendorFormDialogComponent, {
        width: '900px',
        maxWidth: '96vw',
        data: { row, mode: 'edit' },
      })
      .afterClosed()
      .subscribe((saved) => {
        if (saved) {
          this.loadList();
          this.toast.show('Courier vendor updated.');
        }
      });
  }

  openViewDesks(): void {
    const row = this.selectedRow();
    if (!row) return;
    this.dialog.open<CourierVendorViewDesksDialogComponent, CourierVendorViewDesksDialogData>(CourierVendorViewDesksDialogComponent, {
      width: '640px',
      maxWidth: '94vw',
      data: { vendor: row },
    });
  }

  openViewContacts(): void {
    const row = this.selectedRow();
    if (!row) return;
    this.dialog.open<CourierVendorViewContactsDialogComponent, CourierVendorViewContactsDialogData>(CourierVendorViewContactsDialogComponent, {
      width: '680px',
      maxWidth: '94vw',
      data: { vendor: row },
    });
  }

  openViewHistory(): void {
    const row = this.selectedRow();
    if (!row) return;
    this.dialog.open<MasterViewHistoryDialogComponent, MasterViewHistoryDialogData>(MasterViewHistoryDialogComponent, {
      width: '640px',
      maxWidth: '94vw',
      data: { config: COURIERVENDOR_CONFIG, row: row as unknown as Record<string, unknown> },
    });
  }

  deleteRow(): void {
    const row = this.selectedRow();
    if (!row) return;
    this.dialog
      .open(ConfirmDialogComponent, {
        width: '420px',
        data: {
          title: 'Delete Courier Vendor',
          message: `This will deactivate "${row.vendorName}" and remove it from the active list. Its history is preserved, but it won't be reachable from this screen afterward. This action is not reversible from this screen.`,
        },
      })
      .afterClosed()
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.masterApi.delete('master/couriervendor', { courierVendorId: row.courierVendorId }).subscribe({
          next: (res) => {
            if (res.success) {
              this.loadList();
              this.toast.show('Courier vendor deactivated.');
            } else {
              // Surfaces the real backend message verbatim — e.g. a real
              // dependency-restriction rejection if one exists (this
              // task's own "Follow actual backend deletion restrictions"
              // instruction; never assumed/invented here).
              this.toast.show(res.message || 'Failed to deactivate this courier vendor.', 'error');
            }
          },
          error: () => this.toast.show('Something went wrong while deactivating this courier vendor.', 'error'),
        });
      });
  }
}
