import { MasterEntityConfig } from '../../master/shared/master-entity-config.model';

// Dedicated — not MasterEntityConfig-driven — see desk-form-dialog.component.ts's
// own comment for why (one combined save-with-locations endpoint, a 2-tab
// UI with site-dependent location loading). Kept and reused ONLY to drive
// the "View / History" action via the existing MasterViewHistoryDialogComponent,
// the same pattern already established for Role Rights/User Master/Email
// Setting. DeskRow already carries the denormalized cityName/siteName/
// parentDeskName fields straight from the real master/desk/get response
// (unlike the generic master entities' own bare foreign-key ids), so the
// View Data tab's own fields read those directly — no optionsSource lookup
// needed for City/Site/Parent Desk.
const DESK_TYPE_OPTIONS = [
  { label: 'MAIN', value: 'MAIN' },
  { label: 'SUB', value: 'SUB' },
];

export const DESK_CONFIG: MasterEntityConfig = {
  entityLabel: 'Desk',
  entityLabelPlural: 'Desks',
  apiBasePath: 'master/desk',
  idField: 'deskId',
  columns: [],
  formFields: [
    { key: 'deskType', label: 'Desk Type', type: 'select', options: DESK_TYPE_OPTIONS },
    { key: 'deskCode', label: 'Desk Code', type: 'text' },
    { key: 'deskName', label: 'Desk Name', type: 'text' },
    { key: 'parentDeskName', label: 'Parent Desk', type: 'text' },
    { key: 'cityName', label: 'City', type: 'text' },
    { key: 'siteName', label: 'Site', type: 'text' },
    { key: 'emailId', label: 'Email', type: 'text' },
    { key: 'emailSignature', label: 'Email Signature', type: 'textarea', fullRow: true },
    { key: 'isActive', label: 'Active', type: 'boolean' },
  ],
  historyColumns: [
    { key: 'actionDate', label: 'Action Date' },
    { key: 'actionType', label: 'Action Type' },
    // Confirmed live: master/desk/history/get's own actionBy is a raw
    // admin/user userId guid (unlike e.g. Email Setting's own history,
    // which already comes back as a plain username) — resolved the same
    // way any other bare foreign-key history column is.
    { key: 'actionBy', label: 'Action By', resolveFrom: { apiBasePath: 'admin/user', fromField: 'actionBy', toField: 'userId', labelField: 'userName' } },
    { key: 'deskType', label: 'Type' },
    { key: 'deskCode', label: 'Desk Code' },
    { key: 'deskName', label: 'Desk Name' },
    { key: 'cityName', label: 'City' },
    { key: 'siteName', label: 'Site' },
    { key: 'emailId', label: 'Email' },
    { key: 'isActive', label: 'Active', boolean: true },
  ],
  buildDeleteRequest: (row) => ({ deskId: row['deskId'] }),
  buildListRequest: (searchText) => ({ searchText: searchText || null, isActive: null }),
  buildHistoryRequest: (row) => ({ deskId: row['deskId'] }),
  // CONFIRMED LIVE: master/desk/history/get is also raw PascalCase (like
  // master/desk/get itself), unlike every other entity's typed/camelCase
  // history response — see master-entity-config.model.ts's own comment
  // (first found and fixed for Email Setting's own history).
  historyRowsArePascalCase: true,
};
