import { Component, HostListener, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { RouterOutlet } from '@angular/router';
import { BreakpointObserver } from '@angular/cdk/layout';
import { TopbarComponent } from '../topbar/topbar.component';
import { SidenavComponent } from '../sidenav/sidenav.component';

const SIDEBAR_COMPACT_STORAGE_KEY = 'mailroom.sidenav.compact';

// Primary nav is the permanent left sidebar (app-sidenav) on desktop,
// demoted to a hamburger-triggered overlay drawer below the tablet
// breakpoint — see shell.component.html's own comment for the mode/opened
// logic. app-topbar carries breadcrumb/search/user-menu/hamburger to the
// right of the sidebar. Structure explicitly pinned by the user — see
// sidenav.component.ts's own class comment for the reverted icon-rail
// attempt and why it was undone.
//
// `sidebarCompact` is owned HERE, as the single source of truth, not
// mirrored from a signal SidenavComponent keeps independently. An earlier
// version had SidenavComponent read localStorage itself and report its
// initial value up via an `@Output` emitted from its own constructor —
// that emit is unreliable in Angular (a child's constructor can run before
// the parent's template has finished wiring up the listener for that
// output), so after a prior session had left compact mode on, this
// component's own `sidebarCompact` could silently stay `false` (the
// default) while SidenavComponent's independent copy correctly came back
// `true` from storage. The visible result was exactly the reported bug: a
// full-width 264px mat-sidenav (driven by this component's stale `false`)
// wrapped around icon-only content with no labels (driven by the child's
// own correct `true`) — a wide box with a narrow icon rail floating in it
// and a large blank gap beside it. Reading storage once, here, and passing
// the result down as a plain @Input makes that mismatch impossible: there
// is only ever one value.
@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, TopbarComponent, SidenavComponent],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss',
})
export class ShellComponent {
  private readonly breakpointObserver = inject(BreakpointObserver);

  protected readonly isCompact = toSignal(
    this.breakpointObserver.observe('(max-width: 959.98px)').pipe(map((r) => r.matches)),
    { initialValue: false },
  );

  protected readonly mobileOpen = signal(false);
  protected readonly sidebarCompact = signal(this.readStoredCompact());

  private readStoredCompact(): boolean {
    try {
      return localStorage.getItem(SIDEBAR_COMPACT_STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  }

  onMenuToggle(): void {
    this.mobileOpen.set(!this.mobileOpen());
  }

  // Parity with the previous mat-sidenav's own default Escape-to-close
  // behavior, now that the mobile drawer is a plain fixed-position element
  // we own ourselves.
  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.mobileOpen()) this.mobileOpen.set(false);
  }

  onLinkClicked(): void {
    this.mobileOpen.set(false);
  }

  toggleSidebarCompact(): void {
    const next = !this.sidebarCompact();
    this.sidebarCompact.set(next);
    try {
      localStorage.setItem(SIDEBAR_COMPACT_STORAGE_KEY, next ? '1' : '0');
    } catch {
      // Per-viewer convenience only — a blocked/unavailable localStorage
      // just means the preference won't survive a reload, nothing breaks.
    }
  }
}
