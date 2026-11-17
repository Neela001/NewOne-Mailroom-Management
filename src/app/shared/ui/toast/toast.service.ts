import { Injectable, signal } from '@angular/core';

export interface ToastMessage {
  id: number;
  text: string;
  variant: 'default' | 'error';
}

let nextId = 0;

// Drop-in replacement for MatSnackBar.open(message, 'Dismiss', {duration}) —
// same call shape (master-list.component.ts/desk-list.component.ts's own
// notify() just calls show() instead), rendered by ToastContainerComponent
// mounted once in app.html instead of Material's global snack-bar overlay.
@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly messages = signal<ToastMessage[]>([]);

  show(text: string, variant: ToastMessage['variant'] = 'default', duration = 4000): void {
    const id = nextId++;
    this.messages.update((list) => [...list, { id, text, variant }]);
    setTimeout(() => this.dismiss(id), duration);
  }

  dismiss(id: number): void {
    this.messages.update((list) => list.filter((m) => m.id !== id));
  }
}
