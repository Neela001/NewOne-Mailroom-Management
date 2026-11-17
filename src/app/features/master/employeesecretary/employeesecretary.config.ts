import { MasterEntityConfig } from '../shared/master-entity-config.model';

// Fields from the live spec's EmployeesecretaryRequest/EmployeesecretaryGetRequest.
export const EMPLOYEESECRETARY_CONFIG: MasterEntityConfig = {
  entityLabel: 'Employee Secretary',
  entityLabelPlural: 'Employee Secretaries',
  apiBasePath: 'master/employeesecretary',
  idField: 'employeeSecretaryId',
  columns: [
    { key: 'employeeName', label: 'Employee', resolveFrom: { apiBasePath: 'master/employee', fromField: 'employeeId', toField: 'employeeId', labelField: 'fullName' } },
    { key: 'secretaryName', label: 'Secretary', resolveFrom: { apiBasePath: 'master/employee', fromField: 'secretaryEmployeeId', toField: 'employeeId', labelField: 'fullName' } },
  ],
  formFields: [
    { key: 'employeeId', label: 'Employee', type: 'select', required: true, optionsSource: { apiBasePath: 'master/employee', valueField: 'employeeId', labelField: 'fullName' } },
    { key: 'secretaryEmployeeId', label: 'Secretary', type: 'select', required: true, optionsSource: { apiBasePath: 'master/employee', valueField: 'employeeId', labelField: 'fullName' } },
    { key: 'remarks', label: 'Remarks', type: 'textarea', fullRow: true },
  ],
  historyColumns: [
    { key: 'actionDate', label: 'Action Date' },
    { key: 'actionType', label: 'Action Type' },
    { key: 'actionBy', label: 'Action By' },
    { key: 'employeeName', label: 'Employee', resolveFrom: { apiBasePath: 'master/employee', fromField: 'employeeId', toField: 'employeeId', labelField: 'fullName' } },
    { key: 'secretaryName', label: 'Secretary', resolveFrom: { apiBasePath: 'master/employee', fromField: 'secretaryEmployeeId', toField: 'employeeId', labelField: 'fullName' } },
    { key: 'isActive', label: 'Active' },
  ],
  buildDeleteRequest: (row) => ({ employeeSecretaryId: row['employeeSecretaryId'] }),
  buildListRequest: (searchText) => ({ searchText: searchText || null, isActive: null }),
  buildHistoryRequest: (row) => ({ employeeSecretaryId: row['employeeSecretaryId'] }),
};
