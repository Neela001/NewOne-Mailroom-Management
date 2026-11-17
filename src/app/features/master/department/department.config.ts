import { MasterEntityConfig } from '../shared/master-entity-config.model';

// Fields from the live spec's DepartmentRequest/DepartmentGetRequest.
export const DEPARTMENT_CONFIG: MasterEntityConfig = {
  entityLabel: 'Department',
  entityLabelPlural: 'Departments',
  apiBasePath: 'master/department',
  idField: 'departmentId',
  columns: [
    { key: 'companyName', label: 'Company', resolveFrom: { apiBasePath: 'master/company', fromField: 'companyId', toField: 'companyId', labelField: 'companyName' } },
    { key: 'divisionName', label: 'Division', resolveFrom: { apiBasePath: 'master/division', fromField: 'divisionId', toField: 'divisionId', labelField: 'divisionName' } },
    { key: 'departmentCode', label: 'Code' },
    { key: 'departmentName', label: 'Name' },
  ],
  formFields: [
    { key: 'companyId', label: 'Company', type: 'select', required: true, optionsSource: { apiBasePath: 'master/company', valueField: 'companyId', labelField: 'companyName' } },
    { key: 'divisionId', label: 'Division', type: 'select', optionsSource: { apiBasePath: 'master/division', valueField: 'divisionId', labelField: 'divisionName' } },
    { key: 'departmentCode', label: 'Department Code', type: 'text', required: true },
    { key: 'departmentName', label: 'Department Name', type: 'text', required: true },
    { key: 'remarks', label: 'Remarks', type: 'textarea', fullRow: true },
  ],
  historyColumns: [
    { key: 'actionDate', label: 'Action Date' },
    { key: 'actionType', label: 'Action Type' },
    { key: 'actionBy', label: 'Action By' },
    { key: 'companyName', label: 'Company', resolveFrom: { apiBasePath: 'master/company', fromField: 'companyId', toField: 'companyId', labelField: 'companyName' } },
    { key: 'divisionName', label: 'Division', resolveFrom: { apiBasePath: 'master/division', fromField: 'divisionId', toField: 'divisionId', labelField: 'divisionName' } },
    { key: 'departmentCode', label: 'Code' },
    { key: 'departmentName', label: 'Name' },
    { key: 'isActive', label: 'Active' },
  ],
  buildDeleteRequest: (row) => ({ departmentId: row['departmentId'] }),
  buildListRequest: (searchText) => ({ searchText: searchText || null, isActive: null }),
  buildHistoryRequest: (row) => ({ departmentId: row['departmentId'] }),
};
