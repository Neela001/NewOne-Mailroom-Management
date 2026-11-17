import { Component, computed, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DialogService } from '../../../shared/ui/dialog/dialog.service';
import { MenuService } from '../../../core/services/menu.service';
import { MasterApiService } from '../shared/master-api.service';
import { EMPLOYEE_CONFIG } from './employee.config';
import { EmployeeRow } from './employee.model';
import { EmployeeFormDialogComponent, EmployeeFormDialogData, EmployeeFormDialogResult } from './employee-form-dialog.component';
import { CompanyRow } from '../company/company.model';
import { MasterViewHistoryDialogComponent, MasterViewHistoryDialogData } from '../shared/master-view-history-dialog.component';
import { ConfirmDialogComponent } from '../shared/confirm-dialog.component';
import { ApiService } from '../../../core/services/api.service';
import { ButtonComponent } from '../../../shared/ui/button/button.component';
import { SelectComponent, SelectOption } from '../../../shared/ui/form/select.component';
import { ComboboxComponent } from '../../../shared/ui/form/combobox.component';
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
const ALL_COMPANIES_VALUE = '';

// Dedicated — not MasterListComponent-driven. Employee Master's own
// Add/Edit is a genuinely complex 3-tab workflow (Employee Details,
// Locations, Secretaries) built on a dedicated combined-assignment API
// family (master/employee/save-with-assignments etc.) that has no shape
// in the generic formFields model whatsoever — see
// employee-form-dialog.component.ts's own class-level comment and
// employee.model.ts's own comment for the full confirmed-live API
// writeup. EMPLOYEE_CONFIG is kept and reused here ONLY for the
// "View / History" action via the existing MasterViewHistoryDialogComponent.
@Component({
  selector: 'app-employee-list',
  standalone: true,
  imports: [FormsModule, ButtonComponent, SelectComponent, ComboboxComponent, PaginationComponent, EmptyStateComponent, IconComponent],
  templateUrl: './employee-list.component.html',
  styleUrl: './employee-list.component.scss',
})
export class EmployeeListComponent {
  private readonly masterApi = inject(MasterApiService);
  private readonly api = inject(ApiService);
  protected readonly menuService = inject(MenuService);
  private readonly dialog = inject(DialogService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  protected readonly loading = signal(false);
  protected readonly skeletonRows = [1, 2, 3, 4, 5];
  protected readonly headerIcon = computed(() => this.menuService.findIconForRoute(this.router.url) ?? 'badge');
  protected readonly activeFilterOptions = ACTIVE_FILTER_OPTIONS;
  protected readonly activeFilter = signal<ActiveFilter>('active');

  // "(All companies)" first, per this task's own explicit default —
  // CONFIRMED LIVE master/employee/get has no companyId filter param
  // (see employee.model.ts's own comment), so this filter is applied
  // CLIENT-SIDE over the already-fetched full list, same as every other
  // client-side cascade this session.
  protected readonly companiesLoading = signal(true);
  protected readonly companiesError = signal(false);
  private readonly companies = signal<CompanyRow[]>([]);
  protected readonly companyFilterOptions = computed<SelectOption[]>(() => [
    { label: '(All companies)', value: ALL_COMPANIES_VALUE },
    ...this.companies()
      .filter((c) => c.isActive)
      .map((c) => ({ label: c.companyCode ? `${c.companyName} (${c.companyCode})` : (c.companyName ?? ''), value: c.companyId })),
  ]);
  protected readonly companyFilter = signal<string>(ALL_COMPANIES_VALUE);

  private readonly allRows = signal<EmployeeRow[]>([]);
  protected readonly rows = computed(() => {
    const filter = this.activeFilter();
    const companyId = this.companyFilter();
    return this.allRows()
      .filter((r) => (filter === 'all' ? true : r.isActive === (filter === 'active')))
      .filter((r) => (companyId ? r.companyId === companyId : true));
  });

  protected readonly pageSize = 10;
  protected readonly page = signal(1);
  protected readonly pagedRows = computed(() => {
    const start = (this.page() - 1) * this.pageSize;
    return this.rows().slice(start, start + this.pageSize);
  });

  protected readonly searchDisplay = signal('');
  private searchText = '';
  protected readonly selectedRow = signal<EmployeeRow | null>(null);
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
        this.loadCompanies();
        this.loadList();
      }
    });
  }

  private loadCompanies(): void {
    this.companiesLoading.set(true);
    this.companiesError.set(false);
    this.masterApi.get<Record<string, unknown>, CompanyRow>('master/company', { searchText: null, isActive: null }).subscribe({
      next: (companies) => {
        this.companiesLoading.set(false);
        this.companies.set(companies);
      },
      error: () => {
        this.companiesLoading.set(false);
        this.companiesError.set(true);
      },
    });
  }

  loadList(): void {
    this.loading.set(true);
    this.selectedRow.set(null);
    this.masterApi.get<Record<string, unknown>, EmployeeRow>('master/employee', { searchText: this.searchText || null, isActive: null }).subscribe({
      next: (rows) => {
        this.loading.set(false);
        this.allRows.set(rows);
        this.page.set(1);
        this.statusMessage.set('Employees loaded successfully.');
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
    this.loadCompanies();
    this.loadList();
  }

  selectRow(row: EmployeeRow): void {
    const current = this.selectedRow();
    this.selectedRow.set(current && current.employeeId === row.employeeId ? null : row);
  }

  protected isSelected(row: EmployeeRow): boolean {
    return this.selectedRow()?.employeeId === row.employeeId;
  }

  onPageChange(page: number): void {
    this.page.set(page);
  }

  onCompanyFilterChange(value: string): void {
    this.companyFilter.set(value);
    this.page.set(1);
  }

  openAdd(): void {
    this.dialog
      .open<EmployeeFormDialogComponent, EmployeeFormDialogData, EmployeeFormDialogResult>(EmployeeFormDialogComponent, {
        width: '980px',
        maxWidth: '97vw',
        data: { row: null, mode: 'add' },
      })
      .afterClosed()
      .subscribe((saved) => {
        if (saved) {
          this.loadList();
          this.toast.show('Employee added.');
        }
      });
  }

  openEdit(): void {
    const row = this.selectedRow();
    if (!row) return;
    this.dialog
      .open<EmployeeFormDialogComponent, EmployeeFormDialogData, EmployeeFormDialogResult>(EmployeeFormDialogComponent, {
        width: '980px',
        maxWidth: '97vw',
        data: { row, mode: 'edit' },
      })
      .afterClosed()
      .subscribe((saved) => {
        if (saved) {
          this.loadList();
          this.toast.show('Employee updated.');
        }
      });
  }

  openViewHistory(): void {
    const row = this.selectedRow();
    if (!row) return;
    this.dialog.open<MasterViewHistoryDialogComponent, MasterViewHistoryDialogData>(MasterViewHistoryDialogComponent, {
      width: '640px',
      maxWidth: '94vw',
      data: { config: EMPLOYEE_CONFIG, row: row as unknown as Record<string, unknown> },
    });
  }

  deleteRow(): void {
    const row = this.selectedRow();
    if (!row) return;
    this.dialog
      .open(ConfirmDialogComponent, {
        width: '420px',
        data: {
          title: 'Delete Employee',
          message: `This will deactivate "${row.fullName}" along with their Location and Secretary assignments, and remove them from the active list. Their history is preserved, but they won't be reachable from this screen afterward. This action is not reversible from this screen.`,
        },
      })
      .afterClosed()
      .subscribe((confirmed) => {
        if (!confirmed) return;
        // CONFIRMED LIVE delete-with-assignments cascades to the
        // employee's own location/secretary rows too ("Employee and
        // assignments deactivated.") — see employee.model.ts's own
        // comment. Plain master/employee/delete does NOT do this, so it
        // is deliberately not used here.
        this.api.post<{ employeeId: string }, { Status: number; Message: string; EmployeeId: string }[]>('master/employee/delete-with-assignments', { employeeId: row.employeeId }).subscribe({
          next: (res) => {
            if (res.success) {
              this.loadList();
              this.toast.show('Employee deactivated.');
            } else {
              this.toast.show(res.message || 'Failed to deactivate this employee.', 'error');
            }
          },
          error: () => this.toast.show('Something went wrong while deactivating this employee.', 'error'),
        });
      });
  }
}
