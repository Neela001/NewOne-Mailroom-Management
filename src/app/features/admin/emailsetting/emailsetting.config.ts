import { MasterEntityConfig } from '../../master/shared/master-entity-config.model';

// Fields from the live spec's EmailSettingRequest/EmailSettingGetRequest.
// NOT routed as a masterRoute() — see emailsetting-form-dialog.component.ts's
// own comment for why Email Settings is a dedicated feature (Authentication/
// Encryption are real server-driven option sets via master/email-setting/
// options/get — CONFIRMED live this session: authFlag 0/1, encrptMethod
// 0-4 — plus a "Remove saved password" flow and a Reload SMTP Options
// action, none of which the generic trio has a shape for). Kept and reused
// ONLY to drive the "View History" action via the existing
// MasterViewHistoryDialogComponent, the same pattern already established
// for Role Rights/User Master.
const AUTH_OPTIONS = [
  { label: 'No authentication', value: 0 },
  { label: 'Authentication required', value: 1 },
];
const ENCRYPTION_OPTIONS = [
  { label: 'None', value: 0 },
  { label: 'Auto', value: 1 },
  { label: 'SslOnConnect', value: 2 },
  { label: 'StartTls', value: 3 },
  { label: 'StartTlsWhenAvailable', value: 4 },
];

export const EMAILSETTING_CONFIG: MasterEntityConfig = {
  entityLabel: 'Email Setting',
  entityLabelPlural: 'Email Settings',
  apiBasePath: 'master/email-setting',
  idField: 'emailSettingId',
  columns: [
    { key: 'emailName', label: 'Email Name' },
    { key: 'emailAddress', label: 'Email Address' },
    { key: 'smtpServer', label: 'SMTP Server' },
    { key: 'encrptMethodName', label: 'Encryption' },
    { key: 'hasPassword', label: 'Password Set', boolean: true },
  ],
  formFields: [
    { key: 'emailName', label: 'Email Name', type: 'text', required: true },
    { key: 'emailAddress', label: 'Email Address', type: 'text', required: true },
    { key: 'smtpServer', label: 'SMTP Server', type: 'text' },
    { key: 'port', label: 'Port', type: 'text' },
    { key: 'authFlag', label: 'Authentication', type: 'select', options: AUTH_OPTIONS },
    { key: 'encrptMethod', label: 'Encryption Method', type: 'select', options: ENCRYPTION_OPTIONS },
    { key: 'userName', label: 'User Name', type: 'text' },
    { key: 'targetName', label: 'Target Name', type: 'text' },
    { key: 'hasPassword', label: 'Password Set', type: 'boolean' },
    { key: 'remarks', label: 'Remarks', type: 'textarea', fullRow: true },
  ],
  historyColumns: [
    { key: 'actionDate', label: 'Action Date' },
    { key: 'actionType', label: 'Action Type' },
    { key: 'actionBy', label: 'Action By' },
    { key: 'emailName', label: 'Email Name' },
    { key: 'emailAddress', label: 'Email Address' },
    { key: 'hasPassword', label: 'Password Set', boolean: true },
    { key: 'isActive', label: 'Active' },
  ],
  buildDeleteRequest: (row) => ({ emailSettingId: row['emailSettingId'] }),
  buildListRequest: (searchText) => ({ searchText: searchText || null, isActive: null }),
  buildHistoryRequest: (row) => ({ emailSettingId: row['emailSettingId'] }),
  // CONFIRMED LIVE: this entity's own /history/get is also raw PascalCase,
  // unlike the typed/camelCase history responses every other entity has —
  // see master-entity-config.model.ts's own comment.
  historyRowsArePascalCase: true,
};
