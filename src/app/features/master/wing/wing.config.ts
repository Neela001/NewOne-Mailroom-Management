import { MasterEntityConfig } from '../shared/master-entity-config.model';

// Fields from the live spec's WingRequest/WingGetRequest.
export const WING_CONFIG: MasterEntityConfig = {
  entityLabel: 'Wing',
  entityLabelPlural: 'Wings',
  apiBasePath: 'master/wing',
  idField: 'wingId',
  columns: [
    { key: 'floorName', label: 'Floor', resolveFrom: { apiBasePath: 'master/floor', fromField: 'floorId', toField: 'floorId', labelField: 'floorName' } },
    { key: 'wingCode', label: 'Code' },
    { key: 'wingName', label: 'Name' },
  ],
  formFields: [
    { key: 'floorId', label: 'Floor', type: 'select', required: true, optionsSource: { apiBasePath: 'master/floor', valueField: 'floorId', labelField: 'floorName' } },
    { key: 'wingCode', label: 'Wing Code', type: 'text', required: true },
    { key: 'wingName', label: 'Wing Name', type: 'text', required: true },
    { key: 'remarks', label: 'Remarks', type: 'textarea', fullRow: true },
  ],
  historyColumns: [
    { key: 'actionDate', label: 'Action Date' },
    { key: 'actionType', label: 'Action Type' },
    { key: 'actionBy', label: 'Action By' },
    { key: 'floorName', label: 'Floor', resolveFrom: { apiBasePath: 'master/floor', fromField: 'floorId', toField: 'floorId', labelField: 'floorName' } },
    { key: 'wingCode', label: 'Code' },
    { key: 'wingName', label: 'Name' },
    { key: 'isActive', label: 'Active' },
  ],
  buildDeleteRequest: (row) => ({ wingId: row['wingId'] }),
  buildListRequest: (searchText) => ({ searchText: searchText || null, isActive: null }),
  buildHistoryRequest: (row) => ({ wingId: row['wingId'] }),
};
