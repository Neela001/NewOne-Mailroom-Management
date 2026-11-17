import { Component, inject, signal } from '@angular/core';
import { StorageService } from '../../core/services/storage.service';
import { StorageKey } from '../../core/models/storage-key.enum';
import { LoginResponse } from '../../core/models/auth.model';
import { IconComponent } from '../../shared/ui/icon/icon.component';

// Default landing area under the shell. No Dashboard module exists in this
// API yet (see the Phase 1 plan's own scope note — Dashboard/Reports/
// Transaction have no corresponding endpoints in this spec), so this is a
// plain welcome state rather than a fabricated dashboard; real navigation
// happens through the sidebar, which is entirely driven by the
// authenticated user's own real menu rights. The greeting uses the real
// signed-in userName already held in session storage (set by
// AuthService.storeSessionOnSuccess on login) — not invented copy.
@Component({
  selector: 'app-home',
  standalone: true,
  imports: [IconComponent],
  template: `
    <div class="home-page">
      <div class="home-card">
        <span class="home-icon-badge">
          <app-icon name="local_shipping" [size]="28" />
        </span>
        <h2>Welcome back, {{ displayName() }}</h2>
        <p>Choose a section from the menu on the left to get started.</p>
      </div>
    </div>
  `,
  styles: [
    `
      .home-page {
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: calc(100vh - var(--app-topbar-height) - 2 * var(--app-space-6));
      }

      .home-card {
        max-width: 420px;
        width: 100%;
        padding: var(--app-space-7) var(--app-space-6);
        text-align: center;
        border-radius: var(--app-radius-lg);
        border: var(--app-border);
        background: var(--mat-sys-surface);
      }

      .home-icon-badge {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 56px;
        height: 56px;
        border-radius: var(--app-radius-md);
        background: var(--mat-sys-primary-container);
        color: var(--mat-sys-on-primary-container);
        margin-bottom: var(--app-space-4);
      }

      h2 {
        font: var(--mat-sys-headline-small);
        margin: 0 0 var(--app-space-2);
        color: var(--mat-sys-on-surface);
      }

      p {
        font: var(--mat-sys-body-medium);
        margin: 0;
        color: var(--mat-sys-on-surface-variant);
      }
    `,
  ],
})
export class HomeComponent {
  private readonly storage = inject(StorageService);
  protected readonly displayName = signal(this.storage.get<LoginResponse>(StorageKey.USER)?.userName ?? 'there');
}
