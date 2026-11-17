import { MasterEntityConfig } from '../../master/shared/master-entity-config.model';

// Dedicated — not MasterListComponent-driven — see uploadmaster-list.
// component.ts's own comment for why (exact Windows-reference column/
// field order, real procedure-driven dependency logic the generic
// columns/formFields model has no shape for). Kept and reused ONLY to
// drive the "View / History" action via the existing
// MasterViewHistoryDialogComponent, the same pattern already established
// for Desk/Email Setting/User/Role Rights/Voter.
export const UPLOADMASTER_CONFIG: MasterEntityConfig = {
  entityLabel: 'Upload Definition',
  entityLabelPlural: 'Upload Definitions',
  apiBasePath: 'admin/upload-master',
  idField: 'uploadDefinitionId',
  columns: [],
  formFields: [
    { key: 'uploadName', label: 'Upload Name', type: 'text' },
    { key: 'procedureSchema', label: 'Procedure Schema', type: 'text' },
    { key: 'procedureName', label: 'Procedure', type: 'text' },
    { key: 'xmlParameterName', label: 'XML Parameter', type: 'text' },
    { key: 'contextParameterName', label: 'Context Parameter', type: 'text' },
    { key: 'contextType', label: 'Context Type', type: 'text' },
    { key: 'xmlRootName', label: 'XML Root Name', type: 'text' },
    { key: 'xmlRowName', label: 'XML Row Name', type: 'text' },
    { key: 'columnsCsv', label: 'Columns', type: 'textarea', fullRow: true },
    { key: 'isRetrySafe', label: 'Retry Safe', type: 'boolean' },
    { key: 'isActive', label: 'Active', type: 'boolean' },
  ],
  // CONFIRMED LIVE: admin/upload-master/history/get is also raw PascalCase
  // (like Desk/Email Setting's own history, unlike Voter's typed/camelCase
  // one) — see uploadmaster.model.ts's own comment.
  historyColumns: [
    { key: 'actionDate', label: 'Action Date' },
    { key: 'actionType', label: 'Action Type' },
    { key: 'actionBy', label: 'Action By' },
    { key: 'uploadName', label: 'Upload Name' },
    { key: 'procedureName', label: 'Procedure' },
    { key: 'xmlParameterName', label: 'XML Parameter' },
    { key: 'contextParameterName', label: 'Context Parameter' },
    { key: 'isActive', label: 'Active', boolean: true },
    { key: 'remarks', label: 'Remarks' },
  ],
  buildDeleteRequest: (row) => ({ uploadDefinitionId: row['uploadDefinitionId'] }),
  buildListRequest: (searchText) => ({ searchText: searchText || null, isActive: null }),
  buildHistoryRequest: (row) => ({ uploadDefinitionId: row['uploadDefinitionId'] }),
  historyRowsArePascalCase: true,
};
