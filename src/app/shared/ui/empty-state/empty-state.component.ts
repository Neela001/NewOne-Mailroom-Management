import { Component, input, output } from '@angular/core';
import { IconComponent } from '../icon/icon.component';
import { ButtonComponent } from '../button/button.component';

// Drop-in replacement for the repeated mat-icon + <p> + optional retry
// .app-state-row markup (loading-error / access-denied / empty-list states
// across sidenav, master-list, desk-list, useraudit-list).
@Component({
  selector: 'app-empty-state',
  standalone: true,
  imports: [IconComponent, ButtonComponent],
  template: `
    <div class="flex flex-col items-center gap-3 px-4 py-10 text-center">
      <app-icon [name]="icon()" [size]="26" class="text-navy-300" />
      <p class="m-0 max-w-[340px] text-sm text-navy-500">{{ message() }}</p>
      @if (retryLabel()) {
        <app-button variant="secondary" size="sm" (click)="retry.emit()">{{ retryLabel() }}</app-button>
      }
    </div>
  `,
})
export class EmptyStateComponent {
  readonly icon = input('inbox');
  readonly message = input('');
  readonly retryLabel = input<string | null>(null);
  readonly retry = output<void>();
}
