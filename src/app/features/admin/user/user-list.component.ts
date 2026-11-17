import { Component, computed, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MenuService } from '../../../core/services/menu.service';
import { MasterApiService } from '../../master/shared/master-api.service';
import { ApiService } from '../../../core/services/api.service';
import { DialogService } from '../../../shared/ui/dialog/dialog.service';
import { ConfirmDialogComponent } from '../../master/shared/confirm-dialog.component';
import { MasterViewHistoryDialogComponent, MasterViewHistoryDialogData } from '../../master/shared/master-view-history-dialog.component';
import { UserFormDialogComponent, UserFormDialogData, UserFormDialogResult } from './user-form-dialog.component';
import { UserResetPasswordDialogComponent, UserResetPasswordDialogData } from './user-reset-password-dialog.component';
import { USER_CONFIG } from './user.config';
import { UserRow, userTypeLabel } from './user.model';
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

// Dedicated — not MasterEntityConfig-driven — see user-form-dialog.component.ts's
// own comment for why (3-tab Add/Edit with a combined User+Roles+Desks
// save, plus Unlock User / Reset Password, which the generic trio has no
// shape for). USER_CONFIG is kept, reused only for the "View History"
// action via the existing MasterViewHistoryDialogComponent — same pattern
// already established for Role Rights.
@Component({
  selector: 'app-user-list',
  standalone: true,
  imports: [FormsModule, ButtonComponent, SelectComponent, PaginationComponent, EmptyStateComponent, IconComponent],
  templateUrl: './user-list.component.html',
  styleUrl: './user-list.component.scss',
})
export class UserListComponent {
  private readonly masterApi = inject(MasterApiService);
  private readonly api = inject(ApiService);
  protected readonly menuService = inject(MenuService);
  private readonly dialog = inject(DialogService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  protected readonly userTypeLabel = userTypeLabel;
  protected readonly loading = signal(false);
  protected readonly skeletonRows = [1, 2, 3, 4, 5];
  protected readonly headerIcon = computed(() => this.menuService.findIconForRoute(this.router.url) ?? 'manage_accounts');
  protected readonly activeFilterOptions = ACTIVE_FILTER_OPTIONS;
  protected readonly activeFilter = signal<ActiveFilter>('active');

  private readonly allRows = signal<UserRow[]>([]);
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
  protected readonly selectedRow = signal<UserRow | null>(null);
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
    this.masterApi.get<Record<string, unknown>, UserRow>('admin/user', { searchText: this.searchText || null, isActive: null }).subscribe({
      next: (rows) => {
        this.loading.set(false);
        this.allRows.set(rows);
        this.page.set(1);
        this.statusMessage.set('Users data loaded successfully.');
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

  selectRow(row: UserRow): void {
    const current = this.selectedRow();
    this.selectedRow.set(current && current.userId === row.userId ? null : row);
  }

  protected isSelected(row: UserRow): boolean {
    return this.selectedRow()?.userId === row.userId;
  }

  onPageChange(page: number): void {
    this.page.set(page);
  }

  formatLastLogin(value: string | null): string {
    if (!value) return 'Never';
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString();
  }

  openAdd(): void {
    this.dialog
      .open<UserFormDialogComponent, UserFormDialogData, UserFormDialogResult>(UserFormDialogComponent, {
        width: '680px',
        maxWidth: '94vw',
        data: { row: null, mode: 'add' },
      })
      .afterClosed()
      .subscribe((saved) => {
        if (saved) {
          this.loadList();
          this.toast.show('User added.');
        }
      });
  }

  openEdit(initialTab: 'account' | 'roles' | 'desks' = 'account'): void {
    const row = this.selectedRow();
    if (!row) return;
    this.dialog
      .open<UserFormDialogComponent, UserFormDialogData, UserFormDialogResult>(UserFormDialogComponent, {
        width: '680px',
        maxWidth: '94vw',
        data: { row, mode: 'edit', initialTab },
      })
      .afterClosed()
      .subscribe((saved) => {
        if (saved) {
          this.loadList();
          this.toast.show('User updated.');
        }
      });
  }

  openViewHistory(): void {
    const row = this.selectedRow();
    if (!row) return;
    this.dialog.open<MasterViewHistoryDialogComponent, MasterViewHistoryDialogData>(MasterViewHistoryDialogComponent, {
      width: '640px',
      maxWidth: '94vw',
      data: { config: USER_CONFIG, row: row as unknown as Record<string, unknown> },
    });
  }

  deleteRow(): void {
    const row = this.selectedRow();
    if (!row) return;
    this.dialog
      .open(ConfirmDialogComponent, {
        width: '420px',
        data: {
          title: 'Delete User',
          message: `Are you sure you want to delete "${row.userName}"? This deactivates the account rather than permanently removing it, matching every other record in this system.`,
        },
      })
      .afterClosed()
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.masterApi.delete('admin/user', { userId: row.userId }).subscribe({
          next: (res) => {
            if (res.success) {
              this.loadList();
              this.toast.show('User deactivated.');
            } else {
              this.toast.show(res.message || 'Failed to deactivate this user.', 'error');
            }
          },
          error: () => this.toast.show('Something went wrong while deactivating this user.', 'error'),
        });
      });
  }

  unlockUser(): void {
    const row = this.selectedRow();
    if (!row) return;
    this.dialog
      .open(ConfirmDialogComponent, {
        width: '420px',
        data: { title: 'Unlock User', message: `Unlock "${row.userName}"'s account? Their failed login count will be reset.` },
      })
      .afterClosed()
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.api.post<{ userId: string }, unknown>('admin/user/unlock', { userId: row.userId }).subscribe({
          next: (res) => {
            if (res.success) {
              this.loadList();
              this.toast.show('User unlocked.');
            } else {
              this.toast.show(res.message || 'Failed to unlock this user.', 'error');
            }
          },
          error: () => this.toast.show('Something went wrong while unlocking this user.', 'error'),
        });
      });
  }

  openResetPassword(): void {
    const row = this.selectedRow();
    if (!row) return;
    this.dialog
      .open<UserResetPasswordDialogComponent, UserResetPasswordDialogData, boolean>(UserResetPasswordDialogComponent, {
        width: '420px',
        maxWidth: '94vw',
        data: { userId: row.userId, userName: row.userName },
      })
      .afterClosed()
      .subscribe((saved) => {
        if (saved) this.toast.show('Password reset.');
      });
  }
}
