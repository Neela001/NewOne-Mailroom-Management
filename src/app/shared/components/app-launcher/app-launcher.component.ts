import { Component, ElementRef, HostListener, computed, inject, signal } from '@angular/core';
import { ACCENT_PALETTE, ID_ACCENT_MAP } from './app-launcher-accent';
import { Router } from '@angular/router';
import { ApplicationLauncherService } from '../../../core/services/application-launcher.service';
import { Application } from '../../../core/models/application.model';
import { ToastService } from '../../ui/toast/toast.service';
import { IconComponent } from '../../ui/icon/icon.component';

// A Google-Apps-Launcher-style floating popup, self-contained rather than
// built on the shared app-menu/MenuTriggerDirective pair — that pair closes
// on the FIRST click anywhere inside its panel (fine for a list of single-
// action menu items, wrong here: a 3-column icon grid with its own hover/
// focus treatment and a header title reads as a distinct surface, not
// another dropdown menu), and this component also needs its own close
// animation (see onBackdropOrEscClose()'s own comment), which the shared
// menu doesn't have. Follows the SAME outside-click/Escape idiom
// TopbarComponent's own search dropdown already uses, for consistency.
//
// Gets its data from ApplicationLauncherService ONLY — see that service's
// own comment for why, and mock-applications.data.ts's own comment for
// why `url` is only set on the two entries that are real, already-
// implemented routes in this app.
@Component({
  selector: 'app-launcher',
  standalone: true,
  imports: [IconComponent],
  templateUrl: './app-launcher.component.html',
  styleUrl: './app-launcher.component.scss',
})
export class AppLauncherComponent {
  private readonly launcherService = inject(ApplicationLauncherService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly elementRef = inject(ElementRef<HTMLElement>);

  // Kept mounted for a short window after isOpen() goes false, so the
  // CSS close transition (opacity/scale back down) can actually play —
  // an `@if (isOpen())`-only panel would simply vanish, no exit animation,
  // since nothing here uses the separate @angular/animations package (the
  // "no unnecessary UI libraries" restriction this task itself sets).
  protected readonly isOpen = signal(false);
  protected readonly mounted = signal(false);
  protected readonly pos = signal({ top: 0, left: 0 });
  private closeTimer: ReturnType<typeof setTimeout> | null = null;

  protected readonly applications = signal<Application[]>([]);
  protected readonly loaded = signal(false);

  protected readonly activeApplications = computed(() => this.applications().filter((a) => a.isActive));

  toggle(anchor: HTMLElement): void {
    if (this.isOpen()) {
      this.close();
      return;
    }
    if (!this.loaded()) {
      this.launcherService.getApplications().subscribe((apps) => {
        this.applications.set(apps);
        this.loaded.set(true);
      });
    }

    if (this.closeTimer) {
      clearTimeout(this.closeTimer);
      this.closeTimer = null;
    }

    const rect = anchor.getBoundingClientRect();
    const panelWidth = 360;
    const panelHeight = 420;
    const openUpward = rect.bottom + panelHeight > window.innerHeight && rect.top > panelHeight;
    this.pos.set({
      top: openUpward ? Math.max(8, rect.top - panelHeight - 8) : Math.min(rect.bottom + 8, window.innerHeight - panelHeight - 8),
      left: Math.max(8, Math.min(rect.right - panelWidth, window.innerWidth - panelWidth - 8)),
    });

    this.mounted.set(true);
    // One tick so the panel is actually in the DOM (at scale/opacity 0,
    // per the SCSS's own default state) before the "open" class is added —
    // otherwise the browser coalesces both into one paint and the CSS
    // transition never has a starting frame to animate from.
    requestAnimationFrame(() => this.isOpen.set(true));
  }

  close(): void {
    if (!this.isOpen()) return;
    this.isOpen.set(false);
    this.closeTimer = setTimeout(() => this.mounted.set(false), 180);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.isOpen() && !this.elementRef.nativeElement.contains(event.target as Node)) {
      this.close();
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.close();
  }

  // Purely presentational — a per-tile gradient accent, not part of
  // Application itself (see app-launcher-accent.ts's own comment for why:
  // a future real Software API has no reason to carry decorative color
  // data, and this stays correct for any id it doesn't explicitly know
  // about via the same hashed fallback every id already goes through).
  protected accentClass(id: string): string {
    return ID_ACCENT_MAP[id] ?? ACCENT_PALETTE[this.hashId(id) % ACCENT_PALETTE.length];
  }

  private hashId(id: string): number {
    let hash = 0;
    for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
    return hash;
  }

  protected openApplication(app: Application): void {
    if (!app.isActive) return;
    this.close();
    if (app.url) {
      this.router.navigateByUrl(app.url);
    } else {
      this.toast.show(`${app.name} — application preview only.`);
    }
  }
}
