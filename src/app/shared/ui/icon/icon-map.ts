// Translates this app's EXISTING icon-name vocabulary (Material icon
// ligature names — the names every call site already passes, and the
// exact strings the live backend's own `iconName` field returns for menu
// leaves, see menu.service.ts's own GROUP_ICON_BY_NAME) into the
// kebab-case names lucide-icons.provider.ts registers. Kept as its own
// translation layer rather than renaming call sites or backend data, so
// nothing about the menu/business data model changes — only how an icon
// name is RENDERED.
//
// An icon name this map doesn't recognize (a future backend value, or a
// typo) falls back to a plain neutral glyph rather than rendering nothing
// or throwing — this is a rendering fallback, not fabricated data; the
// underlying label/route/permission for that menu item is untouched.
const MATERIAL_TO_LUCIDE: Record<string, string> = {
  menu: 'menu',
  chevron_right: 'chevron-right',
  chevron_left: 'chevron-left',
  expand_more: 'chevron-down',
  search: 'search',
  close: 'x',
  refresh: 'refresh-cw',
  more_vert: 'more-vertical',
  visibility: 'eye',
  visibility_off: 'eye-off',
  edit: 'pencil',
  delete: 'trash-2',
  history: 'history',
  add: 'plus',
  lock: 'lock',
  lock_outline: 'lock',
  inbox: 'inbox',
  error_outline: 'circle-alert',
  info_outline: 'info',
  login: 'log-in',
  logout: 'log-out',
  sms: 'message-square',
  mail_outline: 'mail',
  apartment: 'building-2',
  verified_user: 'shield-check',
  person_outline: 'user',
  password: 'key-round',
  check_circle_outline: 'circle-check',
  check: 'check',
  description: 'file-text',

  // Menu group icons — see menu.service.ts's own GROUP_ICON_BY_NAME.
  inventory_2: 'package',
  admin_panel_settings: 'shield-user',
  local_shipping: 'truck',
  public: 'globe',
  corporate_fare: 'landmark',
  account_tree: 'network',
  manage_accounts: 'user-cog',
  settings: 'settings',
  storefront: 'store',
  folder_open: 'folder-open',
  dashboard: 'layout-dashboard',

  // Master list toolbar/table — see master-list.component.html's own
  // comment (the Active/Inactive filter pill, column-header sort toggle).
  filter_list_alt: 'list-filter',
  swap_vert: 'arrow-up-down',

  // Topbar user profile / desk switching — see topbar.component.html's own
  // comment and switch-desk-dialog.component.ts's own comment.
  swap_horiz: 'arrow-left-right',
  schedule: 'clock',
  star: 'star',

  // App launcher — see app-launcher.component.ts's own comment and
  // mock-applications.data.ts's own comment for the demo tiles' icons.
  apps: 'grid-3x3',
  group: 'users',
  door_open: 'door-open',

  // Add/Edit popup footer buttons — see master-form-dialog.component.html's
  // own comment. `cancel` is deliberately distinct from `close` (a plain
  // X, used for the icon-only top-right dismiss button) — this is the
  // circled-X glyph for a labeled Close/Cancel footer button specifically.
  save: 'save',
  cancel: 'circle-x',

  // CONFIRMED LIVE: the real admin/user-rights/me row for the Vertical
  // Menu Master screen carries iconName "view_sidebar" (a real Material
  // ligature name) — previously unmapped here, so it fell back to the
  // plain circle glyph. A real name, not invented.
  view_sidebar: 'panel-left',

  // Real iconName values confirmed live on the new Room/Email Setting/
  // Courier Product Group submenu rows (admin/submenu/get) — reusing
  // already-registered Lucide icons rather than adding new imports for a
  // close-enough match. "Voter" (Voter's own real iconName) is not a
  // Material ligature name and has no clean equivalent, so it's left
  // unmapped and falls back to the plain circle glyph, same as any other
  // unrecognized name.
  meeting_room: 'door-open',
  email: 'mail',
  category: 'grid-3x3',

  // Real iconName values confirmed live across admin/submenu/get for the
  // rest of this app's own header icons — every one of these previously
  // fell back to the plain circle glyph (the task's own "generic circular
  // icon" finding), not just User Master's. Reusing an already-registered
  // Lucide icon where a close match exists rather than adding a new import
  // for it; a handful of genuinely new ones (banknote/map-pin/badge/
  // briefcase/layers/map/handshake/home) were added for a real, literal
  // match. "desk" (Desk's own real iconName) and "tune" (Parameters) are
  // treated the same way: desk has no close literal Lucide equivalent, so
  // it's mapped to a close one rather than left as the blank circle; tune
  // reuses the already-registered Settings icon since there's no live
  // screen for Parameters yet to see it on.
  person: 'user',
  account_balance: 'landmark',
  location_city: 'building-2',
  business: 'building-2',
  groups: 'users',
  payments: 'banknote',
  place: 'map-pin',
  pin_drop: 'map-pin',
  badge: 'badge',
  desk: 'briefcase',
  home: 'home',
  layers: 'layers',
  menu_open: 'menu',
  tune: 'settings',
  map: 'map',
  subdirectory_arrow_right: 'chevron-right',
  handshake: 'handshake',
  engineering: 'user-cog',
  view_module: 'grid-3x3',
  // Rich text editor toolbar (app-rich-text-editor) — see its own comment.
  format_bold: 'bold',
  format_italic: 'italic',
  format_underline: 'underline',
  paragraph: 'pilcrow',
  format_list_bulleted: 'list',
  format_list_numbered: 'list-ordered',
  link: 'link',
  line_break: 'corner-down-left',
  // Voter Master's own Import Voters workflow (voter-import-dialog.
  // component.ts) — see its own comment.
  upload: 'upload',
  file_spreadsheet: 'file-spreadsheet',
  browse_image: 'image',
  scan: 'scan-line',
  // Upload Master's own real backend iconName (confirmed live, 2026-11-12,
  // via admin/user-rights/me's own subMenuCode UPLOADMASTER row) —
  // distinct casing from the "upload" key above.
  uploads: 'upload',
  // Upload Files' own Download result/Download failed actions.
  download: 'download',
};

const FALLBACK_ICON = 'circle';

export function materialIconToLucide(name: string | null | undefined): string {
  if (!name) return FALLBACK_ICON;
  return MATERIAL_TO_LUCIDE[name.trim().toLowerCase()] ?? FALLBACK_ICON;
}
