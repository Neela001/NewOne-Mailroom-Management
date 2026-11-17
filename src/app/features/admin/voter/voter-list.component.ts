import { Component, computed, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DialogService } from '../../../shared/ui/dialog/dialog.service';
import { MenuService } from '../../../core/services/menu.service';
import { VoterService } from './voter.service';
import { VoterRow } from './voter.model';
import { VOTER_CONFIG } from './voter.config';
import { VoterFormDialogComponent, VoterFormDialogData, VoterFormDialogResult } from './voter-form-dialog.component';
import { MasterViewHistoryDialogComponent, MasterViewHistoryDialogData } from '../../master/shared/master-view-history-dialog.component';
import { ConfirmDialogComponent } from '../../master/shared/confirm-dialog.component';
import { ButtonComponent } from '../../../shared/ui/button/button.component';
import { InputComponent } from '../../../shared/ui/form/input.component';
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

interface CommittedFilters {
  voterId: string;
  wardNo: string;
  boothNo: string;
  searchText: string;
  status: ActiveFilter;
}

// Voter's own dedicated list screen — NOT MasterListComponent-driven. The
// real Windows reference has its own exact filter set (Voter ID exact /
// Ward No / Booth No / a single combined "Name / relative / house" text
// field / Status), column order and an Import Voters workflow the generic
// config model has no shape for — see voter.model.ts's own comment for the
// real master/voter-record/* endpoints this is built against. VOTER_CONFIG
// is kept and reused only for the "View / History" action via the
// existing MasterViewHistoryDialogComponent.
@Component({
  selector: 'app-voter-list',
  standalone: true,
  imports: [FormsModule, ButtonComponent, InputComponent, SelectComponent, PaginationComponent, EmptyStateComponent, IconComponent],
  templateUrl: './voter-list.component.html',
  styleUrl: './voter-list.component.scss',
})
export class VoterListComponent {
  private readonly voterService = inject(VoterService);
  protected readonly menuService = inject(MenuService);
  private readonly dialog = inject(DialogService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  protected readonly loading = signal(false);
  protected readonly skeletonRows = [1, 2, 3, 4, 5];
  protected readonly headerIcon = computed(() => this.menuService.findIconForRoute(this.router.url) ?? 'badge');
  protected readonly activeFilterOptions = ACTIVE_FILTER_OPTIONS;

  // Draft values the user is currently typing — only applied to the real
  // query when Search is pressed (matching every other list screen's own
  // "commit, don't live-filter" convention), tracked as real signals (not
  // plain fields) since scopeLabel-style computed()s elsewhere in this app
  // have broken from reading a plain mutable field — see useraudit-list.
  // component.ts's own committed-signal comment for the exact bug this
  // avoids.
  protected readonly voterIdDraft = signal('');
  protected readonly wardNoDraft = signal('');
  protected readonly boothNoDraft = signal('');
  protected readonly searchTextDraft = signal('');
  protected readonly statusDraft = signal<ActiveFilter>('active');

  private readonly committed = signal<CommittedFilters>({ voterId: '', wardNo: '', boothNo: '', searchText: '', status: 'active' });

  private readonly allRows = signal<VoterRow[]>([]);
  protected readonly rows = computed(() => {
    const status = this.committed().status;
    if (status === 'all') return this.allRows();
    return this.allRows().filter((r) => r.isActive === (status === 'active'));
  });

  protected readonly pageSize = 15;
  protected readonly page = signal(1);
  protected readonly pagedRows = computed(() => {
    const start = (this.page() - 1) * this.pageSize;
    return this.rows().slice(start, start + this.pageSize);
  });

  protected readonly selectedRow = signal<VoterRow | null>(null);
  protected readonly statusMessage = signal<string | null>(null);
  protected readonly rights = signal({ canView: true, canAdd: false, canEdit: false, canDelete: false });
  private hasFetchedList = false;

  constructor() {
    // Same reactive-rights fix as every other dedicated list's own
    // constructor comment — mounts at the same time as SidenavComponent
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
    const c = this.committed();
    this.loading.set(true);
    this.selectedRow.set(null);
    this.voterService
      .get({
        voterId: c.voterId || null,
        wardNo: c.wardNo || null,
        boothNo: c.boothNo || null,
        searchText: c.searchText || null,
        isActive: null,
      })
      .subscribe({
        next: (rows) => {
          this.loading.set(false);
          this.allRows.set(rows);
          this.page.set(1);
          this.statusMessage.set('Voters data loaded successfully.');
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
    this.committed.set({
      voterId: this.voterIdDraft().trim(),
      wardNo: this.wardNoDraft().trim(),
      boothNo: this.boothNoDraft().trim(),
      searchText: this.searchTextDraft().trim(),
      status: this.statusDraft(),
    });
    this.loadList();
  }

  refresh(): void {
    this.loadList();
  }

  selectRow(row: VoterRow): void {
    const current = this.selectedRow();
    this.selectedRow.set(current && current.voterRecordId === row.voterRecordId ? null : row);
  }

  protected isSelected(row: VoterRow): boolean {
    return this.selectedRow()?.voterRecordId === row.voterRecordId;
  }

  onPageChange(page: number): void {
    this.page.set(page);
  }

  openAdd(): void {
    this.dialog
      .open<VoterFormDialogComponent, VoterFormDialogData, VoterFormDialogResult>(VoterFormDialogComponent, {
        width: '720px',
        maxWidth: '94vw',
        data: { row: null, mode: 'add' },
      })
      .afterClosed()
      .subscribe((saved) => {
        if (saved) {
          this.loadList();
          this.toast.show('Voter added.');
        }
      });
  }

  openEdit(): void {
    const row = this.selectedRow();
    if (!row) return;
    this.dialog
      .open<VoterFormDialogComponent, VoterFormDialogData, VoterFormDialogResult>(VoterFormDialogComponent, {
        width: '720px',
        maxWidth: '94vw',
        data: { row, mode: 'edit' },
      })
      .afterClosed()
      .subscribe((saved) => {
        if (saved) {
          this.loadList();
          this.toast.show('Voter updated.');
        }
      });
  }

  openViewHistory(): void {
    const row = this.selectedRow();
    if (!row) return;
    this.dialog.open<MasterViewHistoryDialogComponent, MasterViewHistoryDialogData>(MasterViewHistoryDialogComponent, {
      width: '640px',
      maxWidth: '94vw',
      data: { config: VOTER_CONFIG, row: row as unknown as Record<string, unknown> },
    });
  }

  deleteRow(): void {
    const row = this.selectedRow();
    if (!row) return;
    this.dialog
      .open(ConfirmDialogComponent, {
        width: '420px',
        data: {
          title: 'Delete Voter',
          message: `Are you sure you want to delete voter "${row.name ?? row.voterId}"? Like other records in this system, this deactivates it rather than permanently removing it.`,
        },
      })
      .afterClosed()
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.voterService.delete(row.voterRecordId).subscribe({
          next: (res) => {
            if (res.success) {
              this.loadList();
              this.toast.show('Voter deactivated.');
            } else {
              this.toast.show(res.message || 'Failed to deactivate this voter.', 'error');
            }
          },
          error: () => this.toast.show('Something went wrong while deactivating this voter.', 'error'),
        });
      });
  }

  openImport(): void {
    import('./voter-import-dialog.component').then(({ VoterImportDialogComponent }) => {
      this.dialog
        .open(VoterImportDialogComponent, {
          width: '96vw',
          maxWidth: '1800px',
          height: '90vh',
          panelClass: 'app-dialog-panel--fill',
        })
        .afterClosed()
        .subscribe((imported) => {
          if (imported) {
            this.loadList();
          }
        });
    });
  }
}
