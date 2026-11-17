import { MasterEntityConfig } from '../shared/master-entity-config.model';

// Fields from the live spec's FloorRequest/FloorGetRequest.
export const FLOOR_CONFIG: MasterEntityConfig = {
  entityLabel: 'Floor',
  entityLabelPlural: 'Floors',
  apiBasePath: 'master/floor',
  idField: 'floorId',
  columns: [
    { key: 'buildingName', label: 'Building', resolveFrom: { apiBasePath: 'master/building', fromField: 'buildingId', toField: 'buildingId', labelField: 'buildingName' } },
    { key: 'floorCode', label: 'Code' },
    { key: 'floorName', label: 'Name' },
  ],
  formFields: [
    { key: 'buildingId', label: 'Building', type: 'select', required: true, optionsSource: { apiBasePath: 'master/building', valueField: 'buildingId', labelField: 'buildingName' } },
    { key: 'floorCode', label: 'Floor Code', type: 'text', required: true },
    { key: 'floorName', label: 'Floor Name', type: 'text', required: true },
    { key: 'remarks', label: 'Remarks', type: 'textarea', fullRow: true },
  ],
  historyColumns: [
    { key: 'actionDate', label: 'Action Date' },
    { key: 'actionType', label: 'Action Type' },
    { key: 'actionBy', label: 'Action By' },
    { key: 'buildingName', label: 'Building', resolveFrom: { apiBasePath: 'master/building', fromField: 'buildingId', toField: 'buildingId', labelField: 'buildingName' } },
    { key: 'floorCode', label: 'Code' },
    { key: 'floorName', label: 'Name' },
    { key: 'isActive', label: 'Active' },
  ],
  buildDeleteRequest: (row) => ({ floorId: row['floorId'] }),
  buildListRequest: (searchText) => ({ searchText: searchText || null, isActive: null }),
  buildHistoryRequest: (row) => ({ floorId: row['floorId'] }),
};
