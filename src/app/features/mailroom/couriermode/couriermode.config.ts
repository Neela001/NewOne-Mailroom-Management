import { MasterEntityConfig } from '../../master/shared/master-entity-config.model';

// Fields from the live spec's CourierModeRequest/CourierModeGetRequest.
// MAILROOM-software-only entity (confirmed via admin/submenu/get: SubMenu
// "MODE" sits under Master > Service Provider, softwareId set to the real
// MAILROOM software id) — route path matches that real menuUrl exactly.
export const COURIERMODE_CONFIG: MasterEntityConfig = {
  entityLabel: 'Courier Mode',
  entityLabelPlural: 'Courier Modes',
  apiBasePath: 'master/couriermode',
  idField: 'courierModeId',
  columns: [
    { key: 'modeCode', label: 'Code' },
    { key: 'modeName', label: 'Name' },
  ],
  formFields: [
    { key: 'modeCode', label: 'Mode Code', type: 'text', required: true },
    { key: 'modeName', label: 'Mode Name', type: 'text', required: true },
    { key: 'remarks', label: 'Remarks', type: 'textarea', fullRow: true },
  ],
  historyColumns: [
    { key: 'actionDate', label: 'Action Date' },
    { key: 'actionType', label: 'Action Type' },
    { key: 'actionBy', label: 'Action By' },
    { key: 'modeCode', label: 'Code' },
    { key: 'modeName', label: 'Name' },
    // CONFIRMED LIVE (couriermode.model.ts's own comment): Remarks sent
    // on add/edit are genuinely persisted and returned on the matching
    // history/get row — surfaced here so "Remarks are saved in history"
    // (this entity's own Add dialog helper text) is actually visible.
    { key: 'remarks', label: 'Remarks' },
  ],
  buildDeleteRequest: (row) => ({ courierModeId: row['courierModeId'] }),
  buildListRequest: (searchText) => ({ searchText: searchText || null, isActive: null }),
  buildHistoryRequest: (row) => ({ courierModeId: row['courierModeId'] }),
  // CONFIRMED LIVE: master/couriermode/history/get has no typed
  // CourierModeHistoryResponse schema in the real Swagger spec (only a
  // CourierModeHistoryGetRequest for the input) — it falls through to the
  // same untyped, raw-PascalCase response shape as the plain /get family,
  // unlike the typed/camelCase history responses most entities have —
  // without this flag, MasterViewHistoryDialogComponent's History Data
  // tab silently rendered zero populated cells despite a correct
  // "N history record(s)" count (same root cause first found for Email
  // Setting/Desk/Upload Master — see master-entity-config.model.ts's own
  // comment).
  historyRowsArePascalCase: true,
};
