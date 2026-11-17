import { Directive, ElementRef, inject, input } from '@angular/core';
import { MenuComponent } from './menu.component';

// Drop-in replacement for [matMenuTriggerFor] — same template shape:
// <button [appMenuTriggerFor]="rowMenu">…</button><app-menu #rowMenu>…</app-menu>
@Directive({
  selector: '[appMenuTriggerFor]',
  standalone: true,
  host: {
    '(click)': 'onClick($event)',
  },
})
export class MenuTriggerDirective {
  readonly appMenuTriggerFor = input.required<MenuComponent>();
  // Optional override for a panel wider than every other call site's
  // default 180px (e.g. the topbar's own richer user-profile panel) — see
  // menu.component.ts's own toggle() comment.
  readonly appMenuTriggerPanelWidth = input<number>(180);
  private readonly elementRef = inject(ElementRef<HTMLElement>);

  protected onClick(event: Event): void {
    event.stopPropagation();
    this.appMenuTriggerFor().toggle(this.elementRef.nativeElement, this.appMenuTriggerPanelWidth());
  }
}
