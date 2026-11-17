import { Injectable, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';
import { ApiService } from './api.service';
import { StorageService } from './storage.service';
import { StorageKey } from '../models/storage-key.enum';
import { LoginUserRightRow, MenuTreeNode } from '../models/menu.model';
import { routes as appRoutes } from '../../app.routes';

// The real, concrete set of paths this Angular app has a route for — built
// directly from app.routes.ts's own route table (the single source of
// truth every masterRoute()/dedicated route is already registered in),
// never a second, hand-maintained list that could drift from it. Used to
// tell a real backend menu entry with nowhere to actually go (see
// MenuTreeNode.implemented's own comment) from one that does, without
// hardcoding either list.
function collectImplementedRoutePaths(): Set<string> {
  const appNode = appRoutes.find((r) => r.path === 'app');
  const paths = new Set<string>();
  for (const child of appNode?.children ?? []) {
    if (child.path) paths.add(`/app/${child.path}`);
  }
  return paths;
}
const IMPLEMENTED_ROUTE_PATHS = collectImplementedRoutePaths();

// See transformRows()'s own comment for why this exists — only consulted
// for a subMenu row whose real menuUrl is null.
const MENU_URL_FALLBACK_BY_SUBMENU_CODE: Record<string, string> = {
  UPLOADMASTER: '/admin/uploadmaster',
  UPLOADFILES: '/admin/uploadfiles',
};

// A real mainMenu/verticalMenu NAME the backend already gave us (unlike
// subMenu rows, these two levels carry no `iconName` of their own in the
// live spec) mapped to a meaningful Material icon, purely for display —
// never a new label, route, or permission. Replaces a single hardcoded
// 'folder'/'label' for every group regardless of what it actually is.
// Matched case-insensitively against the real mainMenuName/verticalMenuName
// text; an unrecognized real name (a future backend addition this map
// hasn't been updated for) falls back to a plain, still-distinct icon
// rather than guessing or breaking.
const GROUP_ICON_BY_NAME: Record<string, string> = {
  masters: 'inventory_2',
  master: 'inventory_2',
  admin: 'admin_panel_settings',
  'mailroom masters': 'local_shipping',
  country: 'public',
  site: 'apartment',
  organisation: 'corporate_fare',
  organization: 'corporate_fare',
  menu: 'account_tree',
  user: 'manage_accounts',
  setting: 'settings',
  'service provider': 'storefront',
};

function inferGroupIcon(name: string | null, fallback: string): string {
  if (!name) return fallback;
  return GROUP_ICON_BY_NAME[name.trim().toLowerCase()] ?? fallback;
}

// Every node.routerLink is built from a bare menuUrl (no query string — see
// transformRows()'s own comment), but a caller's own url (router.url,
// urlAfterRedirects) can legitimately carry one now — e.g. Role Master's
// own "Role Rights" button navigates to '/app/admin/rolerights?roleId=...'
// (see MasterEntityConfig.secondaryAction's own comment). CONFIRMED LIVE
// regression without this: arriving via that query param made every
// routerLink === url lookup below fail (no node's own bare routerLink could
// ever match a url with '?roleId=...' appended), so rights/icon/breadcrumb/
// active-branch all silently fell back to their own "not found" state —
// fixed by matching on the path only, never the query string.
function stripQueryParams(url: string): string {
  const i = url.indexOf('?');
  return i === -1 ? url : url.slice(0, i);
}

// ----------------------------------------------------------------------------
// The REAL NewOne Windows desktop app's own icon set, matched by the real
// mainMenu/verticalMenu/subMenu NAME text (confirmed live against the
// actual admin/user-rights/me response, 44 rows, 2026-11 — see this
// session's own sidebar-icon-mapping report) against the real files in
// D:\NewOne\Assets\Icons — see newone-icon-map.ts's own provenance comment
// for the icon markup itself. Used ONLY by the sidebar (MenuTreeItemComponent)
// — every other icon usage in the app (topbar search results, buttons,
// dialogs) keeps using the existing Lucide-based `icon` field untouched.
//
// Every one of the 5 real MainMenu groups (Dashboard/Admin/Master/
// Transaction/Reports) has an EXACT NewOne icon. Two VerticalMenu groups
// ("Service Provider", "Inbound") have no exact NewOne icon of their own —
// CourierServiceProvider.svg / InboundCourier.svg are the closest real
// NewOne assets for those concepts, used as a deliberate close match, not
// a guess. "Mail Room" (DASHBOARD's own vertical) has no exact or close
// NewOne icon at all and isn't listed here — it falls through to its own
// MainMenu's icon (dashboard) via resolveNewOneIcon()'s own fallback chain.
//
// At the SubMenu (leaf) level, NewOne's asset set only covers a handful of
// the 44 real leaves by name (Country, Site, User — exact) plus three close
// matches from its own generic "Action" icon family (Role Rights ->
// ActionRights, User Audit -> ActionHistory, Email Setting -> ActionMail —
// each meaningfully different from a plain re-use of the parent icon, and
// a better fit for that specific concept). Every other real leaf (Role,
// Desk, Voter, State, City, Postal Code, Area, Building, Floor, Wing,
// Flat, Room, Company[ Group], Branch, Division, Department, Cost Center,
// Designation, Employee, Vendor[ Staff], every Courier/SP Service-Provider
// leaf, Inbound Log Entry, Inbound Reports, and the three Admin > Menu
// leaves) has NO NewOne-specific icon of its own at all — not silently
// invented, but inherited from its own parent via the same fallback chain,
// so the whole sidebar stays in ONE consistent icon family/density rather
// than mixing in a placeholder from a different set.
const NEWONE_MAIN_ICON: Record<string, string> = {
  dashboard: 'dashboard',
  admin: 'admin',
  master: 'master',
  transaction: 'transaction',
  reports: 'reports',
};

const NEWONE_VERTICAL_ICON: Record<string, string> = {
  menu: 'menu',
  user: 'user',
  setting: 'setting',
  country: 'country',
  site: 'site',
  organisation: 'organisation',
  organization: 'organisation',
  'service provider': 'courier-service-provider',
  inbound: 'inbound-courier',
};

const NEWONE_SUBMENU_ICON: Record<string, string> = {
  country: 'country',
  site: 'site',
  user: 'user',
  'role rights': 'action-rights',
  'user audit': 'action-history',
  'email setting': 'action-mail',
};

function resolveNewOneIcon(mainName: string | null, verticalName: string | null, subName: string | null, parentKey: string): string {
  const norm = (s: string | null) => s?.trim().toLowerCase() ?? '';
  if (subName) {
    const sub = NEWONE_SUBMENU_ICON[norm(subName)];
    if (sub) return sub;
  }
  if (verticalName) {
    const vert = NEWONE_VERTICAL_ICON[norm(verticalName)];
    if (vert) return vert;
  }
  if (mainName) {
    const main = NEWONE_MAIN_ICON[norm(mainName)];
    if (main) return main;
  }
  // Final fallback: inherit whatever the immediate parent already
  // resolved to (passed in by the caller), so a leaf/vertical with no
  // match of its own never falls back to a generic placeholder — it
  // always shows a REAL NewOne icon, just its nearest matched ancestor's.
  return parentKey;
}

// Fetches GET /api/v1/admin/user-rights/me (properly typed in the spec as
// LoginUserRightResponseListApiResponse — a real List<T>, unlike the
// master-entity /get endpoints, see api-response.model.ts's own comment)
// and groups it MainMenu -> VerticalMenu -> SubMenu, same 3-level shape and
// same single-expanded-key accordion tracking as the reference project's
// own MenuService (see menu.model.ts's own comment for why the key scheme
// needs no extra state to make top-level headers collapsible too).
//
// NEW, not in the reference project: a subMenu row with canView === false
// is dropped entirely rather than added to the tree — real, enforced
// per-screen permissions (see menu.model.ts), not just menu presence.
@Injectable({ providedIn: 'root' })
export class MenuService {
  private readonly api = inject(ApiService);
  private readonly storage = inject(StorageService);
  private readonly router = inject(Router);

  readonly menuTree = signal<MenuTreeNode[]>([]);
  readonly isLoading = signal(false);
  readonly hasLoaded = signal(false);
  readonly loadError = signal<string | null>(null);

  private readonly _expandedKey = signal('');
  readonly expandedKey = this._expandedKey.asReadonly();

  private initialized = false;

  initialize(): void {
    if (this.initialized) return;
    this.initialized = true;

    this.fetchRights();

    this.router.events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe((event) => {
      this.syncExpandedBranchToRoute((event as NavigationEnd).urlAfterRedirects);
    });
  }

  toggleBranch(key: string): void {
    this._expandedKey.set(this._expandedKey() === key ? '' : key);
  }

  isBranchExpanded(key: string): boolean {
    const current = this._expandedKey();
    return current === key || current.startsWith(key + '-');
  }

  // Real page-context breadcrumbs, derived from this same tree — not
  // invented section names, not a static per-route title map that would
  // drift from what the backend's menu actually says. Returns the ANCESTOR
  // path only (Main -> Vertical, excluding the current Sub/leaf) — the
  // leaf's own name is already the page's own `<h2>` title (e.g. the page
  // header already reads "Countries"), so repeating it as the last
  // breadcrumb segment would just be a duplicate of the page title one line
  // below it. Returns [] before the tree has loaded or for a route with no
  // matching leaf (e.g. /home), so the topbar can simply hide the
  // breadcrumb row.
  findBreadcrumbTrail(url: string): { label: string }[] {
    url = stripQueryParams(url);
    const search = (nodes: MenuTreeNode[], ancestors: { label: string }[]): { label: string }[] | null => {
      for (const node of nodes) {
        if (node.routerLink === url) return ancestors;
        if (node.items?.length) {
          const found = search(node.items, [...ancestors, { label: node.label }]);
          if (found) return found;
        }
      }
      return null;
    };
    const trail = search(this.menuTree(), []) ?? [];

    // CONFIRMED LIVE: some real mainMenu/verticalMenu pairs share the exact
    // same name — collapse an immediately-repeated label rather than invent
    // a different name for either level.
    return trail.filter((crumb, i) => i === 0 || crumb.label !== trail[i - 1].label);
  }

  // Looks up the real canAdd/canEdit/canDelete/canView rights for a given
  // route, by finding the leaf whose routerLink matches it — used by the
  // generic master-list component to gate its own Add/Edit/Delete buttons
  // without a second API call or prop-drilling the rights down from the
  // route config (they're per-user, not static).
  findRightsForRoute(url: string): { canView: boolean; canAdd: boolean; canEdit: boolean; canDelete: boolean } | null {
    url = stripQueryParams(url);
    const search = (nodes: MenuTreeNode[]): MenuTreeNode | null => {
      for (const node of nodes) {
        if (node.routerLink === url) return node;
        if (node.items?.length) {
          const found = search(node.items);
          if (found) return found;
        }
      }
      return null;
    };
    return search(this.menuTree())?.rights ?? null;
  }

  // The real backend-provided iconName for this route's own leaf (see
  // transformRows()'s own `icon: row.iconName || 'chevron_right'`) — used
  // by the page header's own icon badge, so it shows whatever icon this
  // user's real menu actually carries for this screen rather than an
  // invented per-entity icon. null before the tree loads or for a route
  // with no matching leaf.
  findIconForRoute(url: string): string | null {
    url = stripQueryParams(url);
    const search = (nodes: MenuTreeNode[]): MenuTreeNode | null => {
      for (const node of nodes) {
        if (node.routerLink === url) return node;
        if (node.items?.length) {
          const found = search(node.items);
          if (found) return found;
        }
      }
      return null;
    };
    return search(this.menuTree())?.icon ?? null;
  }

  // Which top-level (mainMenu) group's key contains the current route —
  // drives the mega nav's own active-group highlighting. Independent of
  // which group's panel is currently open/hovered (a pure UI state the nav
  // component owns itself); this is "where am I," not "what's expanded."
  findActiveTopLevelKey(url: string): string | null {
    url = stripQueryParams(url);
    const containsRoute = (node: MenuTreeNode): boolean =>
      node.routerLink === url || !!node.items?.some((child) => containsRoute(child));
    return this.menuTree().find((main) => containsRoute(main))?.key ?? null;
  }

  private fetchRights(): void {
    this.isLoading.set(true);
    this.loadError.set(null);

    this.api.get<LoginUserRightRow[]>('admin/user-rights/me').subscribe({
      next: (res) => {
        this.isLoading.set(false);
        this.hasLoaded.set(true);

        if (!res.success) {
          this.loadError.set(res.message || 'Unable to load menu permissions.');
          return;
        }

        const rows = res.data ?? [];
        this.storage.set(StorageKey.RIGHTS, rows);

        const tree = this.transformRows(rows);
        this.menuTree.set(tree);

        this.syncExpandedBranchToRoute(this.router.url);
      },
      error: () => {
        this.isLoading.set(false);
        this.hasLoaded.set(true);
        this.loadError.set('Failed to load menu. Please try refreshing.');
      },
    });
  }

  private transformRows(rows: LoginUserRightRow[]): MenuTreeNode[] {
    const mains = new Map<string, { node: MenuTreeNode; verticals: Map<string, { node: MenuTreeNode; subs: Map<string, MenuTreeNode> }> }>();
    let mainIndex = 0;

    const sorted = [...rows].sort(
      (a, b) => a.mainMenuOrder - b.mainMenuOrder || a.verticalMenuOrder - b.verticalMenuOrder || a.subMenuOrder - b.subMenuOrder,
    );

    for (const row of sorted) {
      if (!row.canView) continue; // real permission gate, not just presence

      if (!mains.has(row.mainMenuId)) {
        const key = String(mainIndex++);
        mains.set(row.mainMenuId, {
          node: {
            key,
            label: row.mainMenuName ?? row.mainMenuCode ?? 'Menu',
            icon: inferGroupIcon(row.mainMenuName, 'folder_open'),
            newOneIconKey: resolveNewOneIcon(row.mainMenuName, null, null, 'menu'),
            items: [],
          },
          verticals: new Map(),
        });
      }
      const mainEntry = mains.get(row.mainMenuId)!;

      if (!mainEntry.verticals.has(row.verticalMenuId)) {
        const key = `${mainEntry.node.key}-${mainEntry.verticals.size}`;
        const verticalNode: MenuTreeNode = {
          key,
          label: row.verticalMenuName ?? row.verticalMenuCode ?? 'Section',
          icon: inferGroupIcon(row.verticalMenuName, 'folder_open'),
          newOneIconKey: resolveNewOneIcon(row.mainMenuName, row.verticalMenuName, null, mainEntry.node.newOneIconKey),
          items: [],
        };
        mainEntry.node.items!.push(verticalNode);
        mainEntry.verticals.set(row.verticalMenuId, { node: verticalNode, subs: new Map() });
      }
      const verticalEntry = mainEntry.verticals.get(row.verticalMenuId)!;

      if (!verticalEntry.subs.has(row.subMenuId)) {
        const key = `${verticalEntry.node.key}-${verticalEntry.subs.size}`;
        // CONFIRMED LIVE (real backend, real account, 2026-11-12): a
        // handful of real subMenu rows (e.g. subMenuCode UPLOADMASTER,
        // "Upload Master") have menuUrl: null in the backend's own menu
        // data — not a missing API (admin/upload-master/* is real and
        // fully implemented, see uploadmaster.model.ts's own comment),
        // just an unassigned menu URL, which previously rendered this
        // entry as a permanently non-navigable "coming soon" placeholder
        // even once this app had a real route for it. A real backend menu
        // update (assigning the real menuUrl) is the proper long-term fix;
        // until then, this small, explicit, per-subMenuCode fallback — used
        // ONLY when the real menuUrl is actually null — lets the sidebar
        // link to the route this app already has, without touching any
        // other subMenu row's own real, non-null menuUrl.
        const effectiveMenuUrl = row.menuUrl || (row.subMenuCode ? MENU_URL_FALLBACK_BY_SUBMENU_CODE[row.subMenuCode] : undefined);
        const leaf: MenuTreeNode = {
          key,
          label: row.subMenuName ?? row.subMenuCode ?? 'Item',
          icon: row.iconName || 'chevron_right',
          newOneIconKey: resolveNewOneIcon(row.mainMenuName, row.verticalMenuName, row.subMenuName, verticalEntry.node.newOneIconKey),
          // CONFIRMED LIVE (real backend, real account, 2026-10-17): the
          // real menuUrl values come back WITHOUT the `/app` prefix every
          // route in this app is actually mounted under (e.g. the real
          // value is `/master/country`, but the route is `/app/master/
          // country` — see app.routes.ts). Without this prefix,
          // findRightsForRoute()'s own `routerLink === url` comparison
          // against `router.url` (which always includes `/app`) could
          // never match, so canView/canAdd/canEdit/canDelete would never
          // resolve for any screen even with a fully working rights
          // response. Some rows also point at menuUrl values with no
          // corresponding route in this app at all (e.g. `/admin/
          // parameters`, `/mailroom/master/mode`) -- real backend-configured
          // menu entries for screens whose APIs don't exist in the Swagger
          // spec yet (confirmed: re-fetched the live spec, still 175 paths,
          // none of them). Those render as plain non-navigable labels
          // rather than broken links, since no route matches `/app` + that
          // path either way.
          routerLink: effectiveMenuUrl ? `/app${effectiveMenuUrl}` : undefined,
          rights: { canView: row.canView, canAdd: row.canAdd, canEdit: row.canEdit, canDelete: row.canDelete },
          implemented: !!effectiveMenuUrl && IMPLEMENTED_ROUTE_PATHS.has(`/app${effectiveMenuUrl}`),
        };
        verticalEntry.node.items!.push(leaf);
        verticalEntry.subs.set(row.subMenuId, leaf);
      }
    }

    return Array.from(mains.values()).map((entry) => entry.node);
  }

  private syncExpandedBranchToRoute(url: string): void {
    const branchKey = this.findBranchKeyForRoute(this.menuTree(), stripQueryParams(url));
    if (branchKey) this._expandedKey.set(branchKey);
  }

  private findBranchKeyForRoute(nodes: MenuTreeNode[], url: string, ancestorKey = ''): string | null {
    for (const node of nodes) {
      if (node.routerLink && node.routerLink === url) {
        return ancestorKey || node.key;
      }
      if (node.items?.length) {
        const found = this.findBranchKeyForRoute(node.items, url, node.key);
        if (found) return found;
      }
    }
    return null;
  }
}
