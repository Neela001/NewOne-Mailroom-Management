import { MasterEntityConfig } from '../shared/master-entity-config.model';

// Fields from the live spec's CostcenterRequest/CostcenterGetRequest.
export const COSTCENTER_CONFIG: MasterEntityConfig = {
  entityLabel: 'Cost Center',
  entityLabelPlural: 'Cost Centers',
  apiBasePath: 'master/costcenter',
  idField: 'costCenterId',
  columns: [
    { key: 'companyName', label: 'Company', resolveFrom: { apiBasePath: 'master/company', fromField: 'companyId', toField: 'companyId', labelField: 'companyName' } },
    { key: 'costCenterCode', label: 'Code' },
    { key: 'costCenterName', label: 'Name' },
  ],
  formFields: [
    { key: 'companyId', label: 'Company', type: 'select', required: true, optionsSource: { apiBasePath: 'master/company', valueField: 'companyId', labelField: 'companyName' } },
    { key: 'costCenterCode', label: 'Cost Center Code', type: 'text', required: true },
    { key: 'costCenterName', label: 'Cost Center Name', type: 'text', required: true },
    { key: 'remarks', label: 'Remarks', type: 'textarea', fullRow: true },
  ],
  historyColumns: [
    { key: 'actionDate', label: 'Action Date' },
    { key: 'actionType', label: 'Action Type' },
    { key: 'actionBy', label: 'Action By' },
    { key: 'companyName', label: 'Company', resolveFrom: { apiBasePath: 'master/company', fromField: 'companyId', toField: 'companyId', labelField: 'companyName' } },
    { key: 'costCenterCode', label: 'Code' },
    { key: 'costCenterName', label: 'Name' },
    { key: 'isActive', label: 'Active' },
  ],
  buildDeleteRequest: (row) => ({ costCenterId: row['costCenterId'] }),
  buildListRequest: (searchText) => ({ searchText: searchText || null, isActive: null }),
  buildHistoryRequest: (row) => ({ costCenterId: row['costCenterId'] }),
};
