import { Component, inject } from '@angular/core';
import { ToastService } from './toast.service';
import { IconComponent } from '../icon/icon.component';

@Component({
  selector: 'app-toast-container',
  standalone: true,
  imports: [IconComponent],
  template: `
    <div class="pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex flex-col items-center gap-2 p-4 sm:items-end">
      @for (msg of toast.messages(); track msg.id) {
        <div
          class="pointer-events-auto flex w-full max-w-sm items-start gap-2.5 rounded-xl border bg-white px-4 py-3 text-sm shadow-lg"
          [class.border-navy-200]="msg.variant === 'default'"
          [class.text-navy-800]="msg.variant === 'default'"
          [class.border-[#e3b3b3]]="msg.variant === 'error'"
          [class.text-error-fg]="msg.variant === 'error'"
          role="status"
        >
          @if (msg.variant === 'error') {
            <app-icon name="error_outline" [size]="17" class="mt-0.5 flex-none text-error-fg" />
          }
          <span class="flex-1">{{ msg.text }}</span>
          <button type="button" class="flex-none text-navy-400 hover:text-navy-700" (click)="toast.dismiss(msg.id)" aria-label="Dismiss">
            <app-icon name="close" [size]="15" />
          </button>
        </div>
      }
    </div>
  `,
})
export class ToastContainerComponent {
  protected readonly toast = inject(ToastService);
}
