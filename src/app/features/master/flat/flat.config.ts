import { MasterEntityConfig } from '../shared/master-entity-config.model';

// Fields from the live spec's FlatRequest/FlatGetRequest.
export const FLAT_CONFIG: MasterEntityConfig = {
  entityLabel: 'Flat',
  entityLabelPlural: 'Flats',
  apiBasePath: 'master/flat',
  idField: 'flatId',
  columns: [
    { key: 'wingName', label: 'Wing', resolveFrom: { apiBasePath: 'master/wing', fromField: 'wingId', toField: 'wingId', labelField: 'wingName' } },
    { key: 'flatCode', label: 'Code' },
    { key: 'flatName', label: 'Name' },
  ],
  formFields: [
    { key: 'wingId', label: 'Wing', type: 'select', required: true, optionsSource: { apiBasePath: 'master/wing', valueField: 'wingId', labelField: 'wingName' } },
    { key: 'flatCode', label: 'Flat Code', type: 'text', required: true },
    { key: 'flatName', label: 'Flat Name', type: 'text', required: true },
    { key: 'remarks', label: 'Remarks', type: 'textarea', fullRow: true },
  ],
  historyColumns: [
    { key: 'actionDate', label: 'Action Date' },
    { key: 'actionType', label: 'Action Type' },
    { key: 'actionBy', label: 'Action By' },
    { key: 'wingName', label: 'Wing', resolveFrom: { apiBasePath: 'master/wing', fromField: 'wingId', toField: 'wingId', labelField: 'wingName' } },
    { key: 'flatCode', label: 'Code' },
    { key: 'flatName', label: 'Name' },
    { key: 'isActive', label: 'Active' },
  ],
  buildDeleteRequest: (row) => ({ flatId: row['flatId'] }),
  buildListRequest: (searchText) => ({ searchText: searchText || null, isActive: null }),
  buildHistoryRequest: (row) => ({ flatId: row['flatId'] }),
};
