import { MasterEntityConfig } from '../shared/master-entity-config.model';

// Fields from the live spec's BranchlocationRequest/BranchlocationGetRequest.
export const BRANCHLOCATION_CONFIG: MasterEntityConfig = {
  entityLabel: 'Branch Location',
  entityLabelPlural: 'Branch Locations',
  apiBasePath: 'master/branchlocation',
  idField: 'branchLocationId',
  columns: [
    { key: 'branchName', label: 'Branch', resolveFrom: { apiBasePath: 'master/branch', fromField: 'branchId', toField: 'branchId', labelField: 'branchName' } },
    { key: 'siteName', label: 'Site', resolveFrom: { apiBasePath: 'master/site', fromField: 'siteId', toField: 'siteId', labelField: 'siteName' } },
    { key: 'buildingName', label: 'Building', resolveFrom: { apiBasePath: 'master/building', fromField: 'buildingId', toField: 'buildingId', labelField: 'buildingName' } },
    { key: 'floorName', label: 'Floor', resolveFrom: { apiBasePath: 'master/floor', fromField: 'floorId', toField: 'floorId', labelField: 'floorName' } },
    { key: 'wingName', label: 'Wing', resolveFrom: { apiBasePath: 'master/wing', fromField: 'wingId', toField: 'wingId', labelField: 'wingName' } },
  ],
  formFields: [
    { key: 'branchId', label: 'Branch', type: 'select', required: true, optionsSource: { apiBasePath: 'master/branch', valueField: 'branchId', labelField: 'branchName' } },
    { key: 'siteId', label: 'Site', type: 'select', optionsSource: { apiBasePath: 'master/site', valueField: 'siteId', labelField: 'siteName' } },
    { key: 'buildingId', label: 'Building', type: 'select', optionsSource: { apiBasePath: 'master/building', valueField: 'buildingId', labelField: 'buildingName' } },
    { key: 'floorId', label: 'Floor', type: 'select', optionsSource: { apiBasePath: 'master/floor', valueField: 'floorId', labelField: 'floorName' } },
    { key: 'wingId', label: 'Wing', type: 'select', optionsSource: { apiBasePath: 'master/wing', valueField: 'wingId', labelField: 'wingName' } },
    { key: 'remarks', label: 'Remarks', type: 'textarea', fullRow: true },
  ],
  historyColumns: [
    { key: 'actionDate', label: 'Action Date' },
    { key: 'actionType', label: 'Action Type' },
    { key: 'actionBy', label: 'Action By' },
    { key: 'branchName', label: 'Branch', resolveFrom: { apiBasePath: 'master/branch', fromField: 'branchId', toField: 'branchId', labelField: 'branchName' } },
    { key: 'siteName', label: 'Site', resolveFrom: { apiBasePath: 'master/site', fromField: 'siteId', toField: 'siteId', labelField: 'siteName' } },
    { key: 'buildingName', label: 'Building', resolveFrom: { apiBasePath: 'master/building', fromField: 'buildingId', toField: 'buildingId', labelField: 'buildingName' } },
    { key: 'floorName', label: 'Floor', resolveFrom: { apiBasePath: 'master/floor', fromField: 'floorId', toField: 'floorId', labelField: 'floorName' } },
    { key: 'wingName', label: 'Wing', resolveFrom: { apiBasePath: 'master/wing', fromField: 'wingId', toField: 'wingId', labelField: 'wingName' } },
    { key: 'isActive', label: 'Active' },
  ],
  buildDeleteRequest: (row) => ({ branchLocationId: row['branchLocationId'] }),
  buildListRequest: (searchText) => ({ searchText: searchText || null, isActive: null }),
  buildHistoryRequest: (row) => ({ branchLocationId: row['branchLocationId'] }),
};
