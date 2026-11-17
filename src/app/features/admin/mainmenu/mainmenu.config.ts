import { MasterEntityConfig } from '../../master/shared/master-entity-config.model';

// Fields from the live spec's MainMenuRequest/MainMenuGetRequest.
//
// softwareId IS a real field on this entity's own schema, but the actual
// NewOne Windows desktop client's own Main Menu Master screen (the real
// reference for this screen's workflow — see this session's own
// design-proposal plan) shows neither a Software column nor a Software
// field on its Add/Edit form, and every real row currently returned by the
// live API has a null softwareId anyway (confirmed live, 2026-11) — so it
// is deliberately NOT surfaced here, matching the real reference workflow
// exactly rather than exposing a field the actual product doesn't use for
// this screen. Same reasoning for isCommon, which the Windows reference's
// own Add Main Menu form doesn't have either.
export const MAINMENU_CONFIG: MasterEntityConfig = {
  entityLabel: 'Main Menu',
  entityLabelPlural: 'Main Menus',
  apiBasePath: 'admin/mainmenu',
  idField: 'mainMenuId',
  // The real backend iconName for this screen's own menu leaf doesn't map to
  // a known icon (falls back to a blank circle glyph — see icon-map.ts's own
  // FALLBACK_ICON), so this page header specifically uses a meaningful
  // menu-related glyph instead.
  headerIconOverride: 'menu',
  columns: [
    { key: 'mainMenuCode', label: 'Code' },
    { key: 'mainMenuName', label: 'Name' },
    { key: 'iconName', label: 'Icon' },
    { key: 'displayOrder', label: 'Order' },
  ],
  formFields: [
    { key: 'mainMenuCode', label: 'Menu Code', type: 'text', required: true },
    { key: 'mainMenuName', label: 'Menu Name', type: 'text', required: true },
    { key: 'iconName', label: 'Icon Name', type: 'text' },
    { key: 'displayOrder', label: 'Display Order', type: 'number' },
    { key: 'remarks', label: 'Remarks', type: 'textarea', fullRow: true },
  ],
  historyColumns: [
    { key: 'actionDate', label: 'Action Date' },
    { key: 'actionType', label: 'Action Type' },
    { key: 'actionBy', label: 'Action By' },
    { key: 'mainMenuCode', label: 'Code' },
    { key: 'mainMenuName', label: 'Name' },
    { key: 'isActive', label: 'Active' },
  ],
  buildDeleteRequest: (row) => ({ mainMenuId: row['mainMenuId'] }),
  buildListRequest: (searchText) => ({ searchText: searchText || null, isActive: null }),
  buildHistoryRequest: (row) => ({ mainMenuId: row['mainMenuId'] }),
};
