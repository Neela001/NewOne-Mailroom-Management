import { MasterEntityConfig } from '../shared/master-entity-config.model';

// Fields from the live spec's DivisionRequest/DivisionGetRequest.
export const DIVISION_CONFIG: MasterEntityConfig = {
  entityLabel: 'Division',
  entityLabelPlural: 'Divisions',
  apiBasePath: 'master/division',
  idField: 'divisionId',
  columns: [
    { key: 'companyName', label: 'Company', resolveFrom: { apiBasePath: 'master/company', fromField: 'companyId', toField: 'companyId', labelField: 'companyName' } },
    { key: 'divisionCode', label: 'Code' },
    { key: 'divisionName', label: 'Name' },
  ],
  formFields: [
    { key: 'companyId', label: 'Company', type: 'select', required: true, optionsSource: { apiBasePath: 'master/company', valueField: 'companyId', labelField: 'companyName' } },
    { key: 'divisionCode', label: 'Division Code', type: 'text', required: true },
    { key: 'divisionName', label: 'Division Name', type: 'text', required: true },
    { key: 'remarks', label: 'Remarks', type: 'textarea', fullRow: true },
  ],
  historyColumns: [
    { key: 'actionDate', label: 'Action Date' },
    { key: 'actionType', label: 'Action Type' },
    { key: 'actionBy', label: 'Action By' },
    { key: 'companyName', label: 'Company', resolveFrom: { apiBasePath: 'master/company', fromField: 'companyId', toField: 'companyId', labelField: 'companyName' } },
    { key: 'divisionCode', label: 'Code' },
    { key: 'divisionName', label: 'Name' },
    { key: 'isActive', label: 'Active' },
  ],
  buildDeleteRequest: (row) => ({ divisionId: row['divisionId'] }),
  buildListRequest: (searchText) => ({ searchText: searchText || null, isActive: null }),
  buildHistoryRequest: (row) => ({ divisionId: row['divisionId'] }),
};
