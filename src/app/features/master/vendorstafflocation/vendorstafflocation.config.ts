import { MasterEntityConfig } from '../shared/master-entity-config.model';

// Fields from the live spec's VendorstafflocationRequest/VendorstafflocationGetRequest.
export const VENDORSTAFFLOCATION_CONFIG: MasterEntityConfig = {
  entityLabel: 'Vendor Staff Location',
  entityLabelPlural: 'Vendor Staff Locations',
  apiBasePath: 'master/vendorstafflocation',
  idField: 'vendorStaffLocationId',
  columns: [
    { key: 'vendorStaffName', label: 'Vendor Staff', resolveFrom: { apiBasePath: 'master/vendorstaff', fromField: 'vendorStaffId', toField: 'vendorStaffId', labelField: 'fullName' } },
    { key: 'siteName', label: 'Site', resolveFrom: { apiBasePath: 'master/site', fromField: 'siteId', toField: 'siteId', labelField: 'siteName' } },
    { key: 'buildingName', label: 'Building', resolveFrom: { apiBasePath: 'master/building', fromField: 'buildingId', toField: 'buildingId', labelField: 'buildingName' } },
    { key: 'floorName', label: 'Floor', resolveFrom: { apiBasePath: 'master/floor', fromField: 'floorId', toField: 'floorId', labelField: 'floorName' } },
    { key: 'wingName', label: 'Wing', resolveFrom: { apiBasePath: 'master/wing', fromField: 'wingId', toField: 'wingId', labelField: 'wingName' } },
  ],
  formFields: [
    { key: 'vendorStaffId', label: 'Vendor Staff', type: 'select', required: true, optionsSource: { apiBasePath: 'master/vendorstaff', valueField: 'vendorStaffId', labelField: 'fullName' } },
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
    { key: 'vendorStaffName', label: 'Vendor Staff', resolveFrom: { apiBasePath: 'master/vendorstaff', fromField: 'vendorStaffId', toField: 'vendorStaffId', labelField: 'fullName' } },
    { key: 'siteName', label: 'Site', resolveFrom: { apiBasePath: 'master/site', fromField: 'siteId', toField: 'siteId', labelField: 'siteName' } },
    { key: 'buildingName', label: 'Building', resolveFrom: { apiBasePath: 'master/building', fromField: 'buildingId', toField: 'buildingId', labelField: 'buildingName' } },
    { key: 'wingName', label: 'Wing', resolveFrom: { apiBasePath: 'master/wing', fromField: 'wingId', toField: 'wingId', labelField: 'wingName' } },
    { key: 'isActive', label: 'Active' },
  ],
  buildDeleteRequest: (row) => ({ vendorStaffLocationId: row['vendorStaffLocationId'] }),
  buildListRequest: (searchText) => ({ searchText: searchText || null, isActive: null }),
  buildHistoryRequest: (row) => ({ vendorStaffLocationId: row['vendorStaffLocationId'] }),
};
