import { Component, computed, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DialogService } from '../../../shared/ui/dialog/dialog.service';
import { MenuService } from '../../../core/services/menu.service';
import { UploadFilesService } from './uploadfiles.service';
import { UploadJobRow } from './uploadfiles.model';
import { UploadFilesUploadDialogComponent, UploadFilesUploadDialogResult } from './uploadfiles-upload-dialog.component';
import { UploadFilesHistoryDialogComponent, UploadFilesHistoryDialogData } from './uploadfiles-history-dialog.component';
import { ButtonComponent } from '../../../shared/ui/button/button.component';
import { EmptyStateComponent } from '../../../shared/ui/empty-state/empty-state.component';
import { IconComponent } from '../../../shared/ui/icon/icon.component';
import { ToastService } from '../../../shared/ui/toast/toast.service';

// Non-terminal status words — a job in one of these states has no result
// file to download yet. UNCONFIRMED against a real job (see
// uploadfiles.model.ts's own UploadJobRow comment for why no real job row
// exists on this account yet) — a substring heuristic rather than a strict
// enum match, so it degrades safely if the real strings differ slightly
// (e.g. "Processing" vs "InProgress" both match "process"/contain neither —
// re-verify and tighten this the first time a real job is observed).
const NON_TERMINAL_STATUS_WORDS = ['pending', 'queue', 'process', 'progress'];

function isTerminalStatus(status: string | null | undefined): boolean {
  if (!status) return false;
  const lower = status.toLowerCase();
  return !NON_TERMINAL_STATUS_WORDS.some((w) => lower.includes(w));
}

// Dedicated — not MasterListComponent-driven — see uploadfiles.model.ts's
// own comment for the real admin/uploads/* endpoints this is built against.
// This screen has no Add/Edit/Delete at all (a job record isn't something
// you edit or delete — it's a monitor + a launch point for a new one), so
// its own action set (Refresh/New upload/Download result/Download failed/
// View history) and permission gating (New upload -> canAdd; everything
// else only needs the screen's own canView) look nothing like every other
// list screen this session.
@Component({
  selector: 'app-uploadfiles-list',
  standalone: true,
  imports: [FormsModule, ButtonComponent, EmptyStateComponent, IconComponent],
  templateUrl: './uploadfiles-list.component.html',
  styleUrl: './uploadfiles-list.component.scss',
})
export class UploadFilesListComponent {
  private readonly uploadFilesService = inject(UploadFilesService);
  protected readonly menuService = inject(MenuService);
  private readonly dialog = inject(DialogService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  protected readonly loading = signal(false);
  protected readonly skeletonRows = [1, 2, 3, 4, 5];
  protected readonly headerIcon = computed(() => this.menuService.findIconForRoute(this.router.url) ?? 'upload');
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly statusMessage = signal<string | null>(null);

  protected readonly rows = signal<UploadJobRow[]>([]);
  protected readonly selectedRow = signal<UploadJobRow | null>(null);

  protected readonly canDownloadResult = computed(() => {
    const row = this.selectedRow();
    return !!row && isTerminalStatus(row.status) && (row.totalCount ?? 0) > 0;
  });
  protected readonly canDownloadFailed = computed(() => {
    const row = this.selectedRow();
    return !!row && (row.failedCount ?? 0) > 0;
  });

  protected readonly downloadingResult = signal(false);
  protected readonly downloadingFailed = signal(false);

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
    this.errorMessage.set(null);
    this.selectedRow.set(null);
    this.uploadFilesService.jobs(null).subscribe({
      next: (rows) => {
        this.loading.set(false);
        this.rows.set(rows);
        this.statusMessage.set(rows.length > 0 ? 'Upload jobs loaded successfully.' : null);
      },
      error: () => {
        this.loading.set(false);
        this.rows.set([]);
        this.errorMessage.set('Something went wrong while loading upload jobs.');
      },
    });
  }

  refresh(): void {
    this.loadList();
  }

  selectRow(row: UploadJobRow): void {
    const current = this.selectedRow();
    this.selectedRow.set(current && current.uploadId === row.uploadId ? null : row);
  }

  protected isSelected(row: UploadJobRow): boolean {
    return this.selectedRow()?.uploadId === row.uploadId;
  }

  protected statusVariant(status: string | null | undefined): 'success' | 'error' | 'info' | 'neutral' {
    if (!status) return 'neutral';
    const lower = status.toLowerCase();
    if (lower.includes('fail') || lower.includes('error')) return 'error';
    if (lower.includes('complet') || lower.includes('success') || lower.includes('done')) return 'success';
    if (NON_TERMINAL_STATUS_WORDS.some((w) => lower.includes(w))) return 'info';
    return 'neutral';
  }

  protected formatUploadedAt(value: string | null | undefined): string {
    if (!value) return '—';
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString();
  }

  openNewUpload(): void {
    this.dialog
      .open<UploadFilesUploadDialogComponent, unknown, UploadFilesUploadDialogResult>(UploadFilesUploadDialogComponent, {
        width: '820px',
        maxWidth: '94vw',
      })
      .afterClosed()
      .subscribe((submitted) => {
        if (submitted) {
          this.loadList();
          this.toast.show('Upload submitted — processing continues in the background.');
        }
      });
  }

  downloadResult(): void {
    const row = this.selectedRow();
    if (!row || this.downloadingResult()) return;
    this.downloadingResult.set(true);
    this.uploadFilesService.downloadResult(row.uploadId, false).subscribe({
      next: (blob) => {
        this.downloadingResult.set(false);
        this.triggerDownload(blob, `${row.uploadName || 'Upload'} result.xlsx`);
      },
      error: () => {
        this.downloadingResult.set(false);
        this.toast.show('The result file is not available for this upload yet.', 'error');
      },
    });
  }

  downloadFailed(): void {
    const row = this.selectedRow();
    if (!row || this.downloadingFailed()) return;
    this.downloadingFailed.set(true);
    this.uploadFilesService.downloadResult(row.uploadId, true).subscribe({
      next: (blob) => {
        this.downloadingFailed.set(false);
        this.triggerDownload(blob, `${row.uploadName || 'Upload'} failed records.xlsx`);
      },
      error: () => {
        this.downloadingFailed.set(false);
        this.toast.show('Could not download the failed records for this upload.', 'error');
      },
    });
  }

  private triggerDownload(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  openViewHistory(): void {
    const row = this.selectedRow();
    if (!row) return;
    this.dialog.open<UploadFilesHistoryDialogComponent, UploadFilesHistoryDialogData>(UploadFilesHistoryDialogComponent, {
      width: '720px',
      maxWidth: '94vw',
      data: { row },
    });
  }
}
