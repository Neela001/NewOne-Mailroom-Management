import { MasterEntityConfig } from '../shared/master-entity-config.model';

// Fields from the live spec's BuildingRequest/BuildingGetRequest.
export const BUILDING_CONFIG: MasterEntityConfig = {
  entityLabel: 'Building',
  entityLabelPlural: 'Buildings',
  apiBasePath: 'master/building',
  idField: 'buildingId',
  columns: [
    { key: 'siteName', label: 'Site', resolveFrom: { apiBasePath: 'master/site', fromField: 'siteId', toField: 'siteId', labelField: 'siteName' } },
    { key: 'buildingCode', label: 'Code' },
    { key: 'buildingName', label: 'Name' },
  ],
  formFields: [
    { key: 'siteId', label: 'Site', type: 'select', required: true, optionsSource: { apiBasePath: 'master/site', valueField: 'siteId', labelField: 'siteName' } },
    { key: 'buildingCode', label: 'Building Code', type: 'text', required: true },
    { key: 'buildingName', label: 'Building Name', type: 'text', required: true },
    { key: 'remarks', label: 'Remarks', type: 'textarea', fullRow: true },
  ],
  historyColumns: [
    { key: 'actionDate', label: 'Action Date' },
    { key: 'actionType', label: 'Action Type' },
    { key: 'actionBy', label: 'Action By' },
    { key: 'siteName', label: 'Site', resolveFrom: { apiBasePath: 'master/site', fromField: 'siteId', toField: 'siteId', labelField: 'siteName' } },
    { key: 'buildingCode', label: 'Code' },
    { key: 'buildingName', label: 'Name' },
    { key: 'isActive', label: 'Active' },
  ],
  buildDeleteRequest: (row) => ({ buildingId: row['buildingId'] }),
  buildListRequest: (searchText) => ({ searchText: searchText || null, isActive: null }),
  buildHistoryRequest: (row) => ({ buildingId: row['buildingId'] }),
};
