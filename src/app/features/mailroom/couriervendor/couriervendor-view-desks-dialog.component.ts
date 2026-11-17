import { Component, Inject, OnInit, inject, signal } from '@angular/core';
import { DIALOG_DATA } from '../../../shared/ui/dialog/dialog-data.token';
import { DialogRef } from '../../../shared/ui/dialog/dialog-ref';
import { ApiService } from '../../../core/services/api.service';
import { normalizeRowKeys } from '../../master/shared/pascal-case.util';
import { CourierVendorDeskAssignmentRow, CourierVendorRow } from './couriervendor.model';
import { ButtonComponent } from '../../../shared/ui/button/button.component';
import { EmptyStateComponent } from '../../../shared/ui/empty-state/empty-state.component';

export interface CourierVendorViewDesksDialogData {
  vendor: CourierVendorRow;
}

// Listing screen's own separate "View Desks" action — a plain read-only
// display of master/couriervendor/desk/get's own real rows for this
// vendor (this task's own explicit "Load actual assigned desk records...
// Do not show fake desk data" instruction). Distinct from the Add/Edit
// dialog's own editable Desks tab.
@Component({
  selector: 'app-couriervendor-view-desks-dialog',
  standalone: true,
  imports: [ButtonComponent, EmptyStateComponent],
  templateUrl: './couriervendor-view-desks-dialog.component.html',
  styleUrl: './couriervendor-view-desks-dialog.component.scss',
})
export class CourierVendorViewDesksDialogComponent implements OnInit {
  private readonly api = inject(ApiService);
  protected readonly dialogRef = inject(DialogRef);

  protected readonly loading = signal(true);
  protected readonly error = signal(false);
  protected readonly rows = signal<CourierVendorDeskAssignmentRow[]>([]);

  constructor(@Inject(DIALOG_DATA) public data: CourierVendorViewDesksDialogData) {}

  ngOnInit(): void {
    this.api.post<{ courierVendorId: string }, Record<string, unknown>[]>('master/couriervendor/desk/get', { courierVendorId: this.data.vendor.courierVendorId }).subscribe({
      next: (res) => {
        this.loading.set(false);
        if (res.success) {
          this.rows.set((res.data ?? []).map((r) => normalizeRowKeys(r)) as unknown as CourierVendorDeskAssignmentRow[]);
        } else {
          this.error.set(true);
        }
      },
      error: () => {
        this.loading.set(false);
        this.error.set(true);
      },
    });
  }
}
