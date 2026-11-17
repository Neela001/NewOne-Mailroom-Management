import { Component, Inject, OnInit, inject, signal } from '@angular/core';
import { DIALOG_DATA } from '../../../shared/ui/dialog/dialog-data.token';
import { DialogRef } from '../../../shared/ui/dialog/dialog-ref';
import { UploadFilesService } from './uploadfiles.service';
import { UploadJobHistoryRow, UploadJobRow } from './uploadfiles.model';
import { ButtonComponent } from '../../../shared/ui/button/button.component';

export interface UploadFilesHistoryDialogData {
  row: UploadJobRow;
}

// Upload Files' own "View / History" action — a single real history table
// (no separate "View Data" tab the way MasterViewHistoryDialogComponent
// has one, since there's no Add/Edit form data to reveal for a job record
// beyond what the list row already shows) over the real
// admin/uploads/history/get endpoint. See uploadfiles.model.ts's own
// UploadJobHistoryRow comment for why its exact field names are
// unconfirmed pending a real job.
@Component({
  selector: 'app-uploadfiles-history-dialog',
  standalone: true,
  imports: [ButtonComponent],
  templateUrl: './uploadfiles-history-dialog.component.html',
  styleUrl: './uploadfiles-history-dialog.component.scss',
})
export class UploadFilesHistoryDialogComponent implements OnInit {
  private readonly uploadFilesService = inject(UploadFilesService);
  protected readonly dialogRef = inject(DialogRef);

  protected readonly loading = signal(true);
  protected readonly rows = signal<UploadJobHistoryRow[]>([]);

  constructor(@Inject(DIALOG_DATA) public data: UploadFilesHistoryDialogData) {}

  ngOnInit(): void {
    this.uploadFilesService.history(this.data.row.uploadId).subscribe({
      next: (rows) => {
        this.loading.set(false);
        this.rows.set(rows);
      },
      error: () => this.loading.set(false),
    });
  }

  protected formatDate(value: string | null | undefined): string {
    if (!value) return '—';
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString();
  }
}
