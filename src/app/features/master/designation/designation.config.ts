import { MasterEntityConfig } from '../shared/master-entity-config.model';

// Fields from the live spec's DesignationRequest/DesignationGetRequest.
export const DESIGNATION_CONFIG: MasterEntityConfig = {
  entityLabel: 'Designation',
  entityLabelPlural: 'Designations',
  apiBasePath: 'master/designation',
  idField: 'designationId',
  columns: [
    { key: 'companyName', label: 'Company', resolveFrom: { apiBasePath: 'master/company', fromField: 'companyId', toField: 'companyId', labelField: 'companyName' } },
    { key: 'designationCode', label: 'Code' },
    { key: 'designationName', label: 'Name' },
    { key: 'designationLevel', label: 'Level' },
  ],
  formFields: [
    { key: 'companyId', label: 'Company', type: 'select', required: true, optionsSource: { apiBasePath: 'master/company', valueField: 'companyId', labelField: 'companyName' } },
    { key: 'designationCode', label: 'Designation Code', type: 'text', required: true },
    { key: 'designationName', label: 'Designation Name', type: 'text', required: true },
    { key: 'designationLevel', label: 'Level', type: 'number' },
    { key: 'remarks', label: 'Remarks', type: 'textarea', fullRow: true },
  ],
  historyColumns: [
    { key: 'actionDate', label: 'Action Date' },
    { key: 'actionType', label: 'Action Type' },
    { key: 'actionBy', label: 'Action By' },
    { key: 'companyName', label: 'Company', resolveFrom: { apiBasePath: 'master/company', fromField: 'companyId', toField: 'companyId', labelField: 'companyName' } },
    { key: 'designationCode', label: 'Code' },
    { key: 'designationName', label: 'Name' },
    { key: 'isActive', label: 'Active' },
  ],
  buildDeleteRequest: (row) => ({ designationId: row['designationId'] }),
  buildListRequest: (searchText) => ({ searchText: searchText || null, isActive: null }),
  buildHistoryRequest: (row) => ({ designationId: row['designationId'] }),
};
