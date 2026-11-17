// Real icon markup copied VERBATIM from D:\NewOne\Assets\Icons\*.svg — the
// actual NewOne Windows desktop client's own icon set (a real sibling app
// for this exact backend, not an arbitrary reference — see this session's
// own design-proposal plan). D:\NewOne itself was never modified; these are
// copies (also saved untouched as reference files under
// public/assets/branding/icons/ — see that folder's own provenance).
//
// The ONLY edit made to each file's own markup, anywhere in this file, is
// `stroke="#000000"` -> `stroke="currentColor"` and dropping the fixed
// width/height attributes (kept only `viewBox`) — every path, title, and
// stroke-width is otherwise byte-for-byte the original asset. This lets
// each icon render in whatever color the sidebar's own existing
// default/hover/active-state classes already set (text-navy-300 /
// text-navy-50 / text-brand-400 — unchanged), the same way the app's
// existing Lucide icons already do, instead of being stuck at a fixed
// black regardless of state.
//
// Keyed by a short icon-id — see menu.service.ts's own
// NEWONE_MAIN_ICON/NEWONE_VERTICAL_ICON/NEWONE_SUBMENU_ICON lookup tables
// for which real mainMenu/verticalMenu/subMenu name maps to which key, and
// this session's own sidebar-icon-mapping report for the full audit of
// which items got an EXACT NewOne icon, a CLOSE match, or inherited their
// own parent's icon because no NewOne asset exists for that specific
// concept at all (reported, never silently invented).
export const NEWONE_ICON_SVG: Record<string, string> = {
  dashboard: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><g fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round"><path d="M5.3 24.5a13 13 0 1 1 21.4 0z"/><path d="M6 16h2.5M8.7 8.7l1.8 1.8M16 5.8v2.5M24 9l-6.5 7.1"/><circle cx="16" cy="18" r="2.2"/></g></svg>`,

  admin: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><g fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round"><path d="M16 3c4 2.7 7.5 3.5 11 4v8c0 6-4.6 10.8-11 14-6.4-3.2-11-8-11-14V7c3.5-.5 7-1.3 11-4z"/><circle cx="16" cy="12.5" r="3"/><path d="M10.7 21c.5-3 2.6-4.5 5.3-4.5s4.8 1.5 5.3 4.5"/></g></svg>`,

  master: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><g fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round"><path d="M7 11V7.5A1.5 1.5 0 0 1 8.5 6h6l2-2H24a2 2 0 0 1 2 2v5"/><rect x="3.5" y="11" width="25" height="16" rx="2.5"/><path d="M11.5 11v4.5h9V11M11 21h10"/></g></svg>`,

  transaction: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><g fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round"><path d="M4 13v-2a2 2 0 0 1 2-2h20M21 4l5 5-5 5M28 19v2a2 2 0 0 1-2 2H6M11 18l-5 5 5 5"/></g></svg>`,

  reports: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><g fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round"><path d="M7 3.5h13l6 6V27a1.5 1.5 0 0 1-1.5 1.5h-17A1.5 1.5 0 0 1 6 27V5a1.5 1.5 0 0 1 1.5-1.5zM20 4v6h5"/><path d="M10.5 23.5h11M12 20.5V17m4 3.5v-7m4 7v-5"/></g></svg>`,

  menu: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><g fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="3.5" width="17" height="6" rx="1.4"/><path d="M7 9.5V24h5m-5-8h5"/><rect x="12" y="13" width="16.5" height="6" rx="1.4"/><rect x="12" y="21" width="16.5" height="6" rx="1.4"/></g></svg>`,

  user: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><g fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="5" width="24" height="22" rx="3"/><circle cx="16" cy="12.3" r="3.5"/><path d="M9 23c.6-3.2 3.2-5 7-5s6.4 1.8 7 5"/></g></svg>`,

  setting: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><g fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h6m5 0h13M4 16h15m5 0h4M4 25h4m5 0h15"/><circle cx="12.5" cy="7" r="2.5"/><circle cx="21.5" cy="16" r="2.5"/><circle cx="10.5" cy="25" r="2.5"/></g></svg>`,

  country: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><g fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round"><circle cx="16" cy="16" r="12"/><ellipse cx="16" cy="16" rx="5.3" ry="12"/><path d="M4 16h24M6.5 8.8c5.7 2.6 13.3 2.6 19 0M6.5 23.2c5.7-2.6 13.3-2.6 19 0"/></g></svg>`,

  site: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><g fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round"><path d="M25.5 13c0 6-6 12-9.5 15-3.5-3-9.5-9-9.5-15a9.5 9.5 0 1 1 19 0z"/><circle cx="16" cy="13" r="3.4"/></g></svg>`,

  organisation: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><g fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round"><rect x="10.5" y="3.5" width="11" height="7" rx="1.4"/><path d="M16 10.5V15M7.5 20v-5h17v5"/><rect x="3" y="20" width="9" height="7.5" rx="1.4"/><rect x="20" y="20" width="9" height="7.5" rx="1.4"/></g></svg>`,

  // Close match (no exact "Service Provider" icon exists in NewOne's own
  // set) — see menu.service.ts's own NEWONE_VERTICAL_ICON comment.
  'courier-service-provider': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><g fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round"><rect x="10" y="4" width="13" height="11" rx="1"/><path d="M15 4v4h3V4 M2.5 19l4 7 3-2-4-7z M7 18l4-1h4.5c2 0 3 1.4 3 3H12 M18.5 20l7-4c2.8-1.5 5 .8 3.2 2.4l-9.5 7c-.8.6-1.7.8-2.7.6l-7-1.5"/></g></svg>`,

  // Close match (no exact "Inbound"/"Inbound Log Entry"/"Inbound Reports"
  // icon exists) — see menu.service.ts's own NEWONE_VERTICAL_ICON comment.
  'inbound-courier': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><g fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8l9-4 9 4-9 4z M3 8v10l9 4 9-4V8 M12 12v10 M8 5.8l9 4v3.4"/><path d="M26 5v12m-3.2-3.2L26 17l3.2-3.2"/><path d="M2.5 22v5.5h27V22 M2.5 22h5l2.5 3h12l2.5-3h5"/></g></svg>`,

  // Close matches from NewOne's own generic "Action" icon family (24x24,
  // same stroke weight/style as the module icons above) for a few submenu
  // leaves whose own concept the 32x32 module set has no icon for at all,
  // but a meaningfully different/better-fitting action glyph exists —
  // see menu.service.ts's own NEWONE_SUBMENU_ICON comment. Every other
  // leaf with no match of its own inherits its parent's icon instead of
  // using one of these as a generic catch-all.
  'action-rights': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.5c2.8 1.9 5.3 2.6 8 3v6.2c0 4.4-3 7.7-8 10-5-2.3-8-5.6-8-10V5.5c2.7-.4 5.2-1.1 8-3zM8.5 11.9l2.3 2.3 4.8-5"/></g></svg>`,

  'action-history': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 4v5h5M3.5 9a8.5 8.5 0 1 1-.2 5M12 7.2v5l3.2 1.9"/></g></svg>`,

  'action-mail': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 6 8 6 8-6"/></g></svg>`,
};

export type NewOneIconKey = keyof typeof NEWONE_ICON_SVG;
