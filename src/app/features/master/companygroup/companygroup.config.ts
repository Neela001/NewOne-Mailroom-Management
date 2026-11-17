import { MasterEntityConfig } from '../shared/master-entity-config.model';

// Fields from the live spec's CompanygroupRequest/CompanygroupGetRequest.
export const COMPANYGROUP_CONFIG: MasterEntityConfig = {
  entityLabel: 'Company Group',
  entityLabelPlural: 'Company Groups',
  apiBasePath: 'master/companygroup',
  idField: 'companyGroupId',
  columns: [
    { key: 'companyGroupCode', label: 'Code' },
    { key: 'companyGroupName', label: 'Name' },
  ],
  formFields: [
    { key: 'companyGroupCode', label: 'Group Code', type: 'text', required: true },
    { key: 'companyGroupName', label: 'Group Name', type: 'text', required: true },
    { key: 'remarks', label: 'Remarks', type: 'textarea', fullRow: true },
  ],
  historyColumns: [
    { key: 'companyGroupCode', label: 'Code' },
    { key: 'companyGroupName', label: 'Name' },
    { key: 'isActive', label: 'Active' },
    { key: 'actionType', label: 'Action' },
    { key: 'actionBy', label: 'By' },
    { key: 'actionDate', label: 'Date' },
  ],
  buildDeleteRequest: (row) => ({ companyGroupId: row['companyGroupId'] }),
  buildListRequest: (searchText) => ({ searchText: searchText || null, isActive: null }),
  buildHistoryRequest: (row) => ({ companyGroupId: row['companyGroupId'] }),
};
