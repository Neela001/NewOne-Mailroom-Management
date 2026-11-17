import { DatePipe } from '@angular/common';
import { Component, ElementRef, EventEmitter, HostListener, Output, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter } from 'rxjs/operators';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { StorageService } from '../../core/services/storage.service';
import { StorageKey } from '../../core/models/storage-key.enum';
import { LoginResponse } from '../../core/models/auth.model';
import { MenuService } from '../../core/services/menu.service';
import { MenuTreeNode } from '../../core/models/menu.model';
import { DeskContextService } from '../../core/services/desk-context.service';
import { IconComponent } from '../../shared/ui/icon/icon.component';
import { ButtonComponent } from '../../shared/ui/button/button.component';
import { MenuComponent } from '../../shared/ui/menu/menu.component';
import { MenuTriggerDirective } from '../../shared/ui/menu/menu-trigger.directive';
import { DialogService } from '../../shared/ui/dialog/dialog.service';
import { SwitchDeskDialogComponent } from './switch-desk-dialog.component';
import { ChangePasswordDialogComponent } from './change-password-dialog.component';
import { AppLauncherComponent } from '../../shared/components/app-launcher/app-launcher.component';

interface SearchResult {
  label: string;
  groupLabel: string;
  routerLink: string;
  icon: string;
}

// The top bar sitting above the page content, to the right of the
// permanent sidebar (see sidenav.component.ts's own comment for why the
// sidebar, not a horizontal mega-menu, is the primary nav). Hosts page
// context (breadcrumb), a global quick-search across every real, permitted
// module, and the user/logout menu — the mobile hamburger (opens the
// sidebar as an overlay drawer below the tablet breakpoint) lives here too,
// since the sidebar itself is hidden off-canvas at that width.
@Component({
  selector: 'app-topbar',
  standalone: true,
  imports: [RouterLink, FormsModule, DatePipe, IconComponent, ButtonComponent, MenuComponent, MenuTriggerDirective, AppLauncherComponent],
  templateUrl: './topbar.component.html',
  styleUrl: './topbar.component.scss',
})
export class TopbarComponent {
  @Output() menuToggle = new EventEmitter<void>();

  private readonly auth = inject(AuthService);
  private readonly storage = inject(StorageService);
  private readonly router = inject(Router);
  private readonly elementRef = inject(ElementRef<HTMLElement>);
  private readonly dialog = inject(DialogService);
  protected readonly menuService = inject(MenuService);
  protected readonly deskContext = inject(DeskContextService);

  // The real stored LoginResponse — displayName/lastLoginDate are the two
  // real fields this app's own model didn't capture until now (see
  // auth.model.ts's own comment); userName is the login-id fallback for a
  // session saved before that change, or if the server ever sends a null
  // displayName.
  private readonly user = this.storage.get<LoginResponse>(StorageKey.USER);
  protected readonly displayName = signal(this.user?.displayName || this.user?.userName || 'User');
  protected readonly userType = signal(this.user?.userType ?? null);
  protected readonly lastLoginDate = signal(this.user?.lastLoginDate ?? null);
  protected readonly searchQuery = signal('');
  protected readonly searchFocused = signal(false);

  protected readonly currentDeskLocationLabel = computed(() => {
    const desk = this.deskContext.currentDesk();
    if (!desk) return '';
    return [desk.siteName, desk.cityName].filter((v) => !!v).join(', ');
  });

  constructor() {
    this.deskContext.initialize();
  }

  openSwitchDesk(): void {
    this.dialog.open(SwitchDeskDialogComponent, { width: '560px', maxWidth: '94vw' });
  }

  openChangePassword(): void {
    this.dialog.open(ChangePasswordDialogComponent, { width: '440px', maxWidth: '94vw' });
  }

  private readonly navigationEnd = toSignal(this.router.events.pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd)), {
    initialValue: null,
  });

  protected readonly breadcrumbTrail = computed(() => {
    this.navigationEnd();
    this.menuService.menuTree();
    return this.menuService.findBreadcrumbTrail(this.router.url);
  });

  // Every real, permitted leaf across the whole tree, flattened once per
  // menu-tree change — the same real data the sidebar renders from, just a
  // different (flat, searchable) view over it, never a second source.
  private readonly flatLeaves = computed(() => {
    const out: SearchResult[] = [];
    const walk = (nodes: MenuTreeNode[], groupLabel: string) => {
      for (const node of nodes) {
        if (node.routerLink && node.implemented) {
          out.push({ label: node.label, groupLabel, routerLink: node.routerLink, icon: node.icon });
        } else if (node.items?.length) {
          walk(node.items, groupLabel || node.label);
        }
      }
    };
    for (const main of this.menuService.menuTree()) walk(main.items ?? [], main.label);
    return out;
  });

  protected readonly searchResults = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    if (!q) return [];
    return this.flatLeaves()
      .filter((item) => item.label.toLowerCase().includes(q))
      .slice(0, 8);
  });

  protected readonly searchOpen = computed(() => this.searchFocused() && this.searchQuery().trim().length > 0);

  onSearchResultSelected(): void {
    this.searchQuery.set('');
    this.searchFocused.set(false);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.elementRef.nativeElement.contains(event.target as Node)) {
      this.searchFocused.set(false);
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.searchFocused.set(false);
  }

  onLogout(): void {
    const finish = () => {
      this.auth.clearSession();
      window.location.href = '/login';
    };
    this.auth.logout().subscribe({ next: finish, error: finish });
  }
}
