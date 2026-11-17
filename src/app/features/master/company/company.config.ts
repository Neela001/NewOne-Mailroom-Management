import { MasterEntityConfig } from '../shared/master-entity-config.model';

// Fields from the live spec's CompanyRequest/CompanyGetRequest (confirmed
// in Phase 1).
export const COMPANY_CONFIG: MasterEntityConfig = {
  entityLabel: 'Company',
  entityLabelPlural: 'Companies',
  apiBasePath: 'master/company',
  idField: 'companyId',
  columns: [
    { key: 'companyGroupName', label: 'Company Group', resolveFrom: { apiBasePath: 'master/companygroup', fromField: 'companyGroupId', toField: 'companyGroupId', labelField: 'companyGroupName' } },
    { key: 'companyCode', label: 'Code' },
    { key: 'companyName', label: 'Name' },
    { key: 'legalName', label: 'Legal Name' },
  ],
  formFields: [
    { key: 'companyGroupId', label: 'Company Group', type: 'select', optionsSource: { apiBasePath: 'master/companygroup', valueField: 'companyGroupId', labelField: 'companyGroupName' } },
    { key: 'companyCode', label: 'Company Code', type: 'text', required: true },
    { key: 'companyName', label: 'Company Name', type: 'text', required: true },
    { key: 'legalName', label: 'Legal Name', type: 'text' },
    { key: 'registrationNo', label: 'Registration No', type: 'text' },
    { key: 'taxRegistrationNo', label: 'Tax Registration No', type: 'text' },
    { key: 'remarks', label: 'Remarks', type: 'textarea', fullRow: true },
  ],
  historyColumns: [
    { key: 'actionDate', label: 'Action Date' },
    { key: 'actionType', label: 'Action Type' },
    { key: 'actionBy', label: 'Action By' },
    { key: 'companyGroupName', label: 'Company Group', resolveFrom: { apiBasePath: 'master/companygroup', fromField: 'companyGroupId', toField: 'companyGroupId', labelField: 'companyGroupName' } },
    { key: 'companyCode', label: 'Code' },
    { key: 'companyName', label: 'Name' },
    { key: 'isActive', label: 'Active' },
  ],
  buildDeleteRequest: (row) => ({ companyId: row['companyId'] }),
  buildListRequest: (searchText) => ({ searchText: searchText || null, isActive: null }),
  buildHistoryRequest: (row) => ({ companyId: row['companyId'] }),
};
