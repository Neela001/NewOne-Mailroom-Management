import { Component, Inject } from '@angular/core';
import { DIALOG_DATA } from '../../../shared/ui/dialog/dialog-data.token';
import { DialogRef } from '../../../shared/ui/dialog/dialog-ref';
import { ButtonComponent } from '../../../shared/ui/button/button.component';

export interface ConfirmDialogData {
  title: string;
  message: string;
}

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [ButtonComponent],
  template: `
    <h2 class="app-dialog-title">{{ data.title }}</h2>
    <p class="app-dialog-body text-sm text-navy-600">{{ data.message }}</p>
    <div class="app-dialog-actions">
      <app-button variant="secondary" (click)="dialogRef.close(false)">Cancel</app-button>
      <app-button variant="destructive" (click)="dialogRef.close(true)">Delete</app-button>
    </div>
  `,
})
export class ConfirmDialogComponent {
  constructor(
    @Inject(DIALOG_DATA) public data: ConfirmDialogData,
    protected readonly dialogRef: DialogRef<boolean>,
  ) {}
}
