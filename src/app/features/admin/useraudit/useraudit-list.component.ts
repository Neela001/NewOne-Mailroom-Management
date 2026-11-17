import { Component, computed, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { UserAuditService } from './useraudit.service';
import { UserAuditEvent, UserAuditSearchRequest } from './useraudit.model';
import { MenuService } from '../../../core/services/menu.service';
import { StorageService } from '../../../core/services/storage.service';
import { StorageKey } from '../../../core/models/storage-key.enum';
import { LoginResponse } from '../../../core/models/auth.model';
import { ButtonComponent } from '../../../shared/ui/button/button.component';
import { InputComponent } from '../../../shared/ui/form/input.component';
import { SelectComponent, SelectOption } from '../../../shared/ui/form/select.component';
import { CheckboxComponent } from '../../../shared/ui/form/checkbox.component';
import { EmptyStateComponent } from '../../../shared/ui/empty-state/empty-state.component';
import { IconComponent } from '../../../shared/ui/icon/icon.component';

type EventsScope = 'me' | 'all';

// A "committed" snapshot of every filter, captured only when Search is
// pressed — Previous/Next/Refresh all reload against THIS, never against
// whatever is currently typed but not yet searched, matching Phase 6's own
// "pagination must retain the last submitted search criteria" requirement.
interface CommittedFilters {
  events: EventsScope;
  userId: string;
  userName: string;
  actionType: string;
  apiStatus: string;
  fromDate: string | null;
  toDate: string | null;
  pageSize: number;
}

// Read-only paginated audit log — see useraudit.model.ts's own comment for
// why this is a dedicated, view-only feature rather than routed through the
// generic MasterListComponent. Real server-side paging throughout (no
// client-side app-pagination here — see load()'s own call) — Previous/Next
// only, per the Windows reference's own toolbar, not a full page-number
// strip.
@Component({
  selector: 'app-useraudit-list',
  standalone: true,
  imports: [FormsModule, ButtonComponent, InputComponent, SelectComponent, CheckboxComponent, EmptyStateComponent, IconComponent],
  templateUrl: './useraudit-list.component.html',
  styleUrl: './useraudit-list.component.scss',
})
export class UserAuditListComponent {
  private readonly auditService = inject(UserAuditService);
  protected readonly menuService = inject(MenuService);
  private readonly storage = inject(StorageService);
  private readonly router = inject(Router);

  private readonly currentUser = this.storage.get<LoginResponse>(StorageKey.USER);
  private readonly currentUserId = this.currentUser?.userId ?? '';

  protected readonly loading = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly skeletonRows = [1, 2, 3, 4, 5];
  protected readonly headerIcon = computed(() => this.menuService.findIconForRoute(this.router.url) ?? 'history');
  protected readonly rows = signal<UserAuditEvent[]>([]);
  protected readonly totalCount = signal(0);
  protected readonly totalPages = signal(0);
  protected readonly pageNumber = signal(1);

  // Live filter state — edited freely, has no effect until Search is
  // pressed (see CommittedFilters's own comment).
  protected readonly events = signal<EventsScope>('me');
  protected readonly userIdFilter = signal('');
  protected readonly userNameFilter = signal('');
  protected readonly actionTypeFilter = signal('');
  protected readonly apiStatusFilter = signal('');
  protected readonly fromDateEnabled = signal(false);
  protected readonly fromDateValue = signal('');
  protected readonly toDateEnabled = signal(false);
  protected readonly toDateValue = signal('');
  protected readonly pageSizeInput = signal(50);

  // A signal, not a plain field — scopeLabel() (and anything else that
  // reads it) must actually re-run when Search commits a new snapshot;
  // reading a plain mutable field from inside computed() tracks no
  // dependency at all, so it would only ever show whatever was true the
  // first time it ran (reproduced live: the Events-scope label stayed
  // frozen on "My events" after switching to All events and searching,
  // even though the real request and the table's own results were correct).
  private readonly committed = signal<CommittedFilters>({
    events: 'me',
    userId: '',
    userName: '',
    actionType: '',
    apiStatus: '',
    fromDate: null,
    toDate: null,
    pageSize: 50,
  });

  protected readonly eventsOptions: SelectOption[] = [
    { label: 'My events', value: 'me' },
    { label: 'All events', value: 'all' },
  ];
  protected readonly resultOptions: SelectOption[] = [
    { label: 'All', value: '' },
    { label: 'Success', value: 'SUCCESS' },
    { label: 'Failed', value: 'FAILED' },
  ];

  protected readonly canGoPrevious = computed(() => this.pageNumber() > 1);
  protected readonly canGoNext = computed(() => this.pageNumber() < this.totalPages());
  // "My events | Page 1 | 50 shown" — reflects the LAST SEARCHED scope, not
  // whatever the Events dropdown is currently set to if Search hasn't been
  // pressed since changing it.
  protected readonly scopeLabel = computed(() => {
    const c = this.committed();
    if (c.userId) return `User ${c.userId.slice(0, 8)}…`;
    return c.events === 'all' ? 'All events' : 'My events';
  });

  protected readonly rights = signal({ canView: true, canAdd: false, canEdit: false, canDelete: false });
  private hasFetchedList = false;

  constructor() {
    effect(() => {
      if (!this.menuService.hasLoaded()) return;
      const found = this.menuService.findRightsForRoute(this.router.url);
      this.rights.set(found ?? { canView: false, canAdd: false, canEdit: false, canDelete: false });

      if (!this.hasFetchedList && this.rights().canView) {
        this.hasFetchedList = true;
        this.search();
      }
    });
  }

  // Combines the current calendar-day value (a plain yyyy-mm-dd from the
  // native date input) with the start/end of that UTC day — "Dates include
  // the entire UTC day" (the reference's own filter-info message), not just
  // the single instant midnight would otherwise mean.
  private static startOfUtcDay(ymd: string): string {
    return `${ymd}T00:00:00.000Z`;
  }
  private static endOfUtcDay(ymd: string): string {
    return `${ymd}T23:59:59.999Z`;
  }

  search(): void {
    this.committed.set({
      events: this.events(),
      userId: this.userIdFilter().trim(),
      userName: this.userNameFilter().trim(),
      actionType: this.actionTypeFilter().trim(),
      apiStatus: this.apiStatusFilter(),
      fromDate: this.fromDateEnabled() && this.fromDateValue() ? UserAuditListComponent.startOfUtcDay(this.fromDateValue()) : null,
      toDate: this.toDateEnabled() && this.toDateValue() ? UserAuditListComponent.endOfUtcDay(this.toDateValue()) : null,
      pageSize: this.pageSizeInput() > 0 ? this.pageSizeInput() : 50,
    });
    this.pageNumber.set(1);
    this.load();
  }

  refresh(): void {
    this.load();
  }

  previous(): void {
    if (!this.canGoPrevious()) return;
    this.pageNumber.update((p) => p - 1);
    this.load();
  }

  next(): void {
    if (!this.canGoNext()) return;
    this.pageNumber.update((p) => p + 1);
    this.load();
  }

  private load(): void {
    const c = this.committed();
    // Explicit User ID always wins; otherwise "My events" sends the real
    // logged-in user's own id, "All events" sends none at all — the
    // backend's own admin/audit/get is what actually enforces (or doesn't)
    // the "all-user search requires ADMIN" rule from here; this screen
    // never computes or hardcodes that check itself (see this session's
    // own investigation report for why — no general "is this user an
    // Administrator" flag exists anywhere else in this app to check against
    // without inventing one).
    const userId = c.userId || (c.events === 'me' ? this.currentUserId : null);

    const req: UserAuditSearchRequest = {
      userId: userId || null,
      userName: c.userName || null,
      actionType: c.actionType || null,
      apiStatus: c.apiStatus || null,
      fromDate: c.fromDate,
      toDate: c.toDate,
      pageNumber: this.pageNumber(),
      pageSize: c.pageSize,
    };

    this.loading.set(true);
    this.errorMessage.set(null);
    this.auditService.search(req).subscribe({
      next: (res) => {
        this.loading.set(false);
        this.rows.set(res.items ?? []);
        this.totalCount.set(res.totalCount);
        this.totalPages.set(res.totalPages);
      },
      error: () => {
        this.loading.set(false);
        this.rows.set([]);
        this.totalCount.set(0);
        this.totalPages.set(0);
        this.errorMessage.set('Something went wrong while loading the audit log. If you selected "All events", this may require an active Administrator role.');
      },
    });
  }

  formatOccurred(value: string | null | undefined): string {
    if (!value) return '—';
    // occurredAtUtc comes back with no trailing 'Z' (confirmed live) despite
    // genuinely being a UTC instant (the field's own name, and its real
    // schema format — date-time) — appending it rather than letting the
    // browser's default Date parsing treat the bare string as local time.
    const iso = value.endsWith('Z') ? value : `${value}Z`;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return value;
    return d.toISOString().replace('T', ' ').replace(/\.\d+Z$/, ' UTC');
  }
}
