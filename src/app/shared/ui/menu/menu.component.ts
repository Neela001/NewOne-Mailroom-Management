import { Component, ElementRef, HostListener, signal } from '@angular/core';

// Drop-in replacement for <mat-menu>/[matMenuTriggerFor] — positioned via
// getBoundingClientRect() + position:fixed (viewport coordinates), not
// position:absolute nested inside the trigger's own scroll container: a
// row's "…" action menu lives inside .app-table-scroll and a dialog's own
// scrollable content, where an absolutely-positioned panel would be
// clipped or scroll away with the row. A full-viewport invisible backdrop
// handles outside-click-to-close; a (click) listener on the panel itself
// closes it after ANY item click without each item needing to know about
// its menu (see this file's own class comment below for why that's safe).
@Component({
  selector: 'app-menu',
  standalone: true,
  host: { class: 'contents' },
  template: `
    @if (isOpen()) {
      <div class="fixed inset-0 z-40" (click)="close()" (contextmenu)="close()"></div>
      <div
        class="fixed z-50 rounded-lg border border-navy-200 bg-white py-1 shadow-lg"
        [style.min-width.px]="panelWidth()"
        [style.top.px]="pos().top"
        [style.left.px]="pos().left"
        (click)="close()"
        (keydown.escape)="close()"
      >
        <ng-content />
      </div>
    }
  `,
})
export class MenuComponent {
  protected readonly isOpen = signal(false);
  protected readonly pos = signal({ top: 0, left: 0 });
  protected readonly panelWidth = signal(180);

  // Every menu item inside is a plain button the caller wires its own
  // (click) handler onto; this (click) listener on the panel (above) fires
  // AFTER the item's own listener during the bubble phase, so the item's
  // action always runs before the menu closes — no MenuItem component or
  // cross-component method call needed for that ordering.
  toggle(anchor: HTMLElement, panelWidth = 180): void {
    if (this.isOpen()) {
      this.close();
      return;
    }
    this.panelWidth.set(panelWidth);
    const rect = anchor.getBoundingClientRect();
    const estHeight = 180;
    const openUpward = rect.bottom + estHeight > window.innerHeight;
    this.pos.set({
      top: openUpward ? Math.max(8, rect.top - estHeight) : rect.bottom + 4,
      left: Math.max(8, Math.min(rect.right - panelWidth, window.innerWidth - panelWidth - 8)),
    });
    this.isOpen.set(true);
  }

  close(): void {
    this.isOpen.set(false);
  }
}
