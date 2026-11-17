import { Component, Inject, OnInit, inject, signal } from '@angular/core';
import { DIALOG_DATA } from '../../../shared/ui/dialog/dialog-data.token';
import { DialogRef } from '../../../shared/ui/dialog/dialog-ref';
import { ApiService } from '../../../core/services/api.service';
import { normalizeRowKeys } from '../../master/shared/pascal-case.util';
import { CourierVendorContactRow, CourierVendorRow } from './couriervendor.model';
import { ButtonComponent } from '../../../shared/ui/button/button.component';
import { EmptyStateComponent } from '../../../shared/ui/empty-state/empty-state.component';

export interface CourierVendorViewContactsDialogData {
  vendor: CourierVendorRow;
}

// Listing screen's own separate "View Contacts" action — a plain
// read-only display of master/couriervendor/contact/get's own real rows
// for this vendor (this task's own explicit "Load actual contact
// records... Handle vendors without contacts" instruction). Distinct
// from the Add/Edit dialog's own editable Contacts tab. Each real contact
// row carries its own Desk — confirmed live, see couriervendor.model.ts's
// own comment — shown here so it's clear which desk a contact belongs to.
@Component({
  selector: 'app-couriervendor-view-contacts-dialog',
  standalone: true,
  imports: [ButtonComponent, EmptyStateComponent],
  templateUrl: './couriervendor-view-contacts-dialog.component.html',
  styleUrl: './couriervendor-view-contacts-dialog.component.scss',
})
export class CourierVendorViewContactsDialogComponent implements OnInit {
  private readonly api = inject(ApiService);
  protected readonly dialogRef = inject(DialogRef);

  protected readonly loading = signal(true);
  protected readonly error = signal(false);
  protected readonly rows = signal<CourierVendorContactRow[]>([]);

  constructor(@Inject(DIALOG_DATA) public data: CourierVendorViewContactsDialogData) {}

  ngOnInit(): void {
    this.api
      .post<{ courierVendorId: string; searchText: null; isActive: null }, Record<string, unknown>[]>('master/couriervendor/contact/get', { courierVendorId: this.data.vendor.courierVendorId, searchText: null, isActive: null })
      .subscribe({
        next: (res) => {
          this.loading.set(false);
          if (res.success) {
            this.rows.set((res.data ?? []).map((r) => normalizeRowKeys(r)) as unknown as CourierVendorContactRow[]);
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
