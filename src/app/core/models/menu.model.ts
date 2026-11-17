// Field-for-field from the live spec's LoginUserRightResponse (returned by
// GET /api/v1/admin/user-rights/me) — a flat row per (user, subMenu) pair,
// the new API's equivalent of the old app's Login/GetUserRights MenuRow.
// Unlike the old app, this row also carries real per-screen permission
// flags (canView/canAdd/canEdit/canDelete) — see MenuTreeNode's own comment
// for how those get threaded into the built tree.
export interface LoginUserRightRow {
  userId: string;
  userName: string | null;
  userType: string | null;
  softwareId: string | null;
  softwareCode: string | null;
  softwareName: string | null;
  mainMenuId: string;
  mainMenuCode: string | null;
  mainMenuName: string | null;
  mainMenuOrder: number;
  verticalMenuId: string;
  verticalMenuCode: string | null;
  verticalMenuName: string | null;
  verticalMenuOrder: number;
  subMenuId: string;
  subMenuCode: string | null;
  subMenuName: string | null;
  menuUrl: string | null;
  formName: string | null;
  iconName: string | null;
  subMenuOrder: number;
  isCommon: boolean;
  canView: boolean;
  canAdd: boolean;
  canEdit: boolean;
  canDelete: boolean;
}

// Tree shape built from LoginUserRightRow[], grouped MainMenu -> VerticalMenu
// -> SubMenu (same 3-level depth as the reference project's own menu tree).
// `key` is the same ancestor-prefixed scheme ("0", "0-1", "0-1-2") the
// reference project's sidebar accordion already uses to track exactly one
// open branch at a time and auto-expand the branch containing the active
// route — see layout/sidenav's own doc comment for why that scheme needs
// zero extra state to also cover the top-level branch.
export interface MenuTreeNode {
  key: string;
  label: string;
  icon: string;
  // The real NewOne Windows app's own icon-key for this node (see
  // newone-icon-map.ts's own provenance comment and menu.service.ts's own
  // NEWONE_MAIN_ICON/NEWONE_VERTICAL_ICON/NEWONE_SUBMENU_ICON lookup
  // tables) — present at every depth, used by the sidebar specifically
  // (MenuTreeItemComponent) instead of `icon` (which stays the Lucide-name
  // fallback used elsewhere, e.g. the topbar's own flattened search
  // results). Never undefined — a name with no NewOne match of its own
  // resolves to its parent's own key, so every sidebar row always has a
  // real NewOne icon, never a placeholder.
  newOneIconKey: string;
  routerLink?: string;
  // Only present on leaf (subMenu) nodes — the real, enforced permissions
  // for this screen. A leaf with canView === false is never reachable, so
  // it isn't even added to the tree (see MenuService.transformRows()).
  rights?: { canView: boolean; canAdd: boolean; canEdit: boolean; canDelete: boolean };
  items?: MenuTreeNode[];
  // Only present on leaf (subMenu) nodes — true only when `routerLink`
  // matches a path this Angular app actually has a route registered for.
  // CONFIRMED LIVE (real backend, real account, 2026-10-17): several real
  // subMenu rows (e.g. the whole "Mailroom Masters > Service Provider"
  // group, "/mailroom/master/mode" etc.) have no corresponding route in
  // app.routes.ts — this build only covers what the real Swagger spec
  // documents (see app.routes.ts's own header comment), and these rows are
  // real, backend-configured menu entries for screens whose APIs don't
  // exist yet. Without this flag those items would render as normal links
  // that silently fall through to the app's wildcard-route redirect to
  // /login on click — not "not found," not disabled, just a confusing
  // bounce back to the login screen. See MenuService.transformRows()'s own
  // comment for how this is computed (from the actual registered routes,
  // never a hand-maintained list).
  implemented?: boolean;
}
