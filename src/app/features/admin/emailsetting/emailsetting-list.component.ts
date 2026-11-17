import { Component, computed, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MenuService } from '../../../core/services/menu.service';
import { ApiService } from '../../../core/services/api.service';
import { DialogService } from '../../../shared/ui/dialog/dialog.service';
import { DialogRef } from '../../../shared/ui/dialog/dialog-ref';
import { ConfirmDialogComponent } from '../../master/shared/confirm-dialog.component';
import { MasterViewHistoryDialogComponent, MasterViewHistoryDialogData } from '../../master/shared/master-view-history-dialog.component';
import { EmailSettingFormDialogComponent, EmailSettingFormDialogData, EmailSettingFormDialogResult } from './emailsetting-form-dialog.component';
import { EMAILSETTING_CONFIG } from './emailsetting.config';
import { EmailSettingRow, SmtpOptionsResponse } from './emailsetting.model';
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

// Dedicated — not MasterEntityConfig-driven — see
// emailsetting-form-dialog.component.ts's own comment for why.
// EMAILSETTING_CONFIG is kept and reused only for the "View History" action
// via the existing MasterViewHistoryDialogComponent, the same pattern
// already established for Role Rights/User Master.
@Component({
  selector: 'app-emailsetting-list',
  standalone: true,
  imports: [FormsModule, ButtonComponent, SelectComponent, PaginationComponent, EmptyStateComponent, IconComponent],
  templateUrl: './emailsetting-list.component.html',
  styleUrl: './emailsetting-list.component.scss',
})
export class EmailSettingListComponent {
  private readonly api = inject(ApiService);
  protected readonly menuService = inject(MenuService);
  private readonly dialog = inject(DialogService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  // Only provided when this component is opened via DialogService (e.g.
  // Add Desk's own "Email settings" button — see desk-form-dialog.
  // component.ts's own comment) rather than reached through its normal
  // admin/emailsetting route — null there, so the exact same component
  // renders the ordinary full list-page chrome unchanged.
  protected readonly dialogRef = inject(DialogRef, { optional: true });

  protected readonly loading = signal(false);
  protected readonly skeletonRows = [1, 2, 3, 4, 5];
  // Embedded (dialogRef set): router.url is whatever host screen opened
  // this dialog (e.g. Add Desk's own '/app/admin/desk'), not this
  // component's own route — looking rights/icon up against it would
  // resolve the HOST's permissions instead of Email Settings' own, so the
  // real route is hardcoded here for that case only; routed normally, this
  // is unchanged.
  private readonly lookupRoute = computed(() => (this.dialogRef ? '/app/admin/emailsetting' : this.router.url));
  protected readonly headerIcon = computed(() => this.menuService.findIconForRoute(this.lookupRoute()) ?? 'mail_outline');
  protected readonly activeFilterOptions = ACTIVE_FILTER_OPTIONS;
  protected readonly activeFilter = signal<ActiveFilter>('active');

  private readonly authNameByValue = signal<Record<number, string>>({});

  private readonly allRows = signal<EmailSettingRow[]>([]);
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
  protected readonly selectedRow = signal<EmailSettingRow | null>(null);
  protected readonly statusMessage = signal<string | null>(null);
  protected readonly rights = signal({ canView: true, canAdd: false, canEdit: false, canDelete: false });
  private hasFetchedList = false;

  constructor() {
    this.api.post<Record<string, never>, SmtpOptionsResponse>('master/email-setting/options/get', {}).subscribe((res) => {
      if (!res.success || !res.data) return;
      const map: Record<number, string> = {};
      for (const o of res.data.authentication) map[o.value] = o.name;
      this.authNameByValue.set(map);
    });

    effect(() => {
      if (!this.menuService.hasLoaded()) return;
      const found = this.menuService.findRightsForRoute(this.lookupRoute());
      this.rights.set(found ?? { canView: false, canAdd: false, canEdit: false, canDelete: false });

      if (!this.hasFetchedList && this.rights().canView) {
        this.hasFetchedList = true;
        this.loadList();
      }
    });
  }

  protected authLabel(row: EmailSettingRow): string {
    if (row.authFlag === null || row.authFlag === undefined) return '—';
    return this.authNameByValue()[row.authFlag] ?? String(row.authFlag);
  }

  loadList(): void {
    this.loading.set(true);
    this.selectedRow.set(null);
    this.api.post<{ searchText: string | null; isActive: null }, Record<string, unknown>[]>('master/email-setting/get', { searchText: this.searchText || null, isActive: null }).subscribe({
      next: (res) => {
        this.loading.set(false);
        this.allRows.set(this.normalizeRows(res.data ?? []));
        this.page.set(1);
        this.statusMessage.set('Email settings data loaded successfully.');
      },
      error: () => {
        this.loading.set(false);
        this.allRows.set([]);
        this.page.set(1);
        this.statusMessage.set(null);
      },
    });
  }

  // CONFIRMED LIVE: like every other master/admin entity's own untyped
  // `/get` response, this one comes back raw PascalCase (EmailSettingId,
  // EmailName, …) rather than the camelCase MasterApiService.get() would
  // normalize — this screen calls ApiService directly (not
  // MasterApiService, since it isn't a MasterEntityConfig entity), so it
  // normalizes its own rows the same way, by the same rule, rather than
  // leaving every field undefined (the exact bug this session's own User
  // Master task already found and fixed once for Desk options/assignment).
  private normalizeRows(rows: Record<string, unknown>[]): EmailSettingRow[] {
    return rows.map((r) => ({
      emailSettingId: String(r['EmailSettingId']),
      emailName: String(r['EmailName'] ?? ''),
      emailAddress: String(r['EmailAddress'] ?? ''),
      authFlag: (r['AuthFlag'] as number) ?? null,
      userName: (r['UserName'] as string) ?? null,
      smtpServer: (r['SMTPServer'] as string) ?? null,
      port: (r['Port'] as string) ?? null,
      encrptMethod: (r['EncrptMethod'] as number) ?? null,
      encrptMethodName: (r['EncrptMethodName'] as string) ?? null,
      targetName: (r['TargetName'] as string) ?? null,
      hasPassword: !!r['HasPassword'],
      isActive: r['IsActive'] !== false,
    }));
  }

  search(): void {
    this.searchText = this.searchDisplay().trim();
    this.loadList();
  }

  refresh(): void {
    this.loadList();
  }

  selectRow(row: EmailSettingRow): void {
    const current = this.selectedRow();
    this.selectedRow.set(current && current.emailSettingId === row.emailSettingId ? null : row);
  }

  protected isSelected(row: EmailSettingRow): boolean {
    return this.selectedRow()?.emailSettingId === row.emailSettingId;
  }

  onPageChange(page: number): void {
    this.page.set(page);
  }

  openAdd(): void {
    this.dialog
      .open<EmailSettingFormDialogComponent, EmailSettingFormDialogData, EmailSettingFormDialogResult>(EmailSettingFormDialogComponent, {
        width: '680px',
        maxWidth: '94vw',
        data: { row: null, mode: 'add' },
      })
      .afterClosed()
      .subscribe((saved) => {
        if (saved) {
          this.loadList();
          this.toast.show('Email setting added.');
        }
      });
  }

  openEdit(): void {
    const row = this.selectedRow();
    if (!row) return;
    this.dialog
      .open<EmailSettingFormDialogComponent, EmailSettingFormDialogData, EmailSettingFormDialogResult>(EmailSettingFormDialogComponent, {
        width: '680px',
        maxWidth: '94vw',
        data: { row, mode: 'edit' },
      })
      .afterClosed()
      .subscribe((saved) => {
        if (saved) {
          this.loadList();
          this.toast.show('Email setting updated.');
        }
      });
  }

  openViewHistory(): void {
    const row = this.selectedRow();
    if (!row) return;
    this.dialog.open<MasterViewHistoryDialogComponent, MasterViewHistoryDialogData>(MasterViewHistoryDialogComponent, {
      width: '640px',
      maxWidth: '94vw',
      data: { config: EMAILSETTING_CONFIG, row: row as unknown as Record<string, unknown> },
    });
  }

  deleteRow(): void {
    const row = this.selectedRow();
    if (!row) return;
    this.dialog
      .open(ConfirmDialogComponent, {
        width: '420px',
        data: {
          title: 'Delete Email Setting',
          message: `Are you sure you want to delete "${row.emailName}"? Like other records in this system, this deactivates it rather than permanently removing it.`,
        },
      })
      .afterClosed()
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.api.post<{ emailSettingId: string }, unknown>('master/email-setting/delete', { emailSettingId: row.emailSettingId }).subscribe({
          next: (res) => {
            if (res.success) {
              this.loadList();
              this.toast.show('Email setting deactivated.');
            } else {
              this.toast.show(res.message || 'Failed to deactivate this email setting.', 'error');
            }
          },
          error: () => this.toast.show('Something went wrong while deactivating this email setting.', 'error'),
        });
      });
  }
}
