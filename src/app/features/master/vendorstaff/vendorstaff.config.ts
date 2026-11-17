import { MasterEntityConfig } from '../shared/master-entity-config.model';

// Fields from the live spec's VendorstaffRequest/VendorstaffGetRequest.
export const VENDORSTAFF_CONFIG: MasterEntityConfig = {
  entityLabel: 'Vendor Staff',
  entityLabelPlural: 'Vendor Staff',
  apiBasePath: 'master/vendorstaff',
  idField: 'vendorStaffId',
  columns: [
    { key: 'vendorName', label: 'Vendor', resolveFrom: { apiBasePath: 'master/vendor', fromField: 'vendorId', toField: 'vendorId', labelField: 'vendorName' } },
    { key: 'companyName', label: 'Company', resolveFrom: { apiBasePath: 'master/company', fromField: 'companyId', toField: 'companyId', labelField: 'companyName' } },
    { key: 'branchName', label: 'Branch', resolveFrom: { apiBasePath: 'master/branch', fromField: 'branchId', toField: 'branchId', labelField: 'branchName' } },
    { key: 'vendorStaffCode', label: 'Code' },
    { key: 'fullName', label: 'Name' },
    { key: 'designationName', label: 'Designation' },
  ],
  formFields: [
    { key: 'vendorId', label: 'Vendor', type: 'select', required: true, optionsSource: { apiBasePath: 'master/vendor', valueField: 'vendorId', labelField: 'vendorName' } },
    { key: 'companyId', label: 'Company', type: 'select', optionsSource: { apiBasePath: 'master/company', valueField: 'companyId', labelField: 'companyName' } },
    { key: 'branchId', label: 'Branch', type: 'select', optionsSource: { apiBasePath: 'master/branch', valueField: 'branchId', labelField: 'branchName' } },
    { key: 'vendorStaffCode', label: 'Staff Code', type: 'text', required: true },
    { key: 'fullName', label: 'Full Name', type: 'text', required: true },
    {
      key: 'gender',
      label: 'Gender',
      type: 'select',
      options: [
        { label: 'Male', value: 'Male' },
        { label: 'Female', value: 'Female' },
        { label: 'Other', value: 'Other' },
      ],
    },
    { key: 'designationName', label: 'Designation', type: 'text' },
    { key: 'emailId', label: 'Email', type: 'text' },
    { key: 'mobileNo', label: 'Mobile No', type: 'text' },
    { key: 'dateOfJoining', label: 'Date of Joining', type: 'date' },
    { key: 'remarks', label: 'Remarks', type: 'textarea', fullRow: true },
  ],
  historyColumns: [
    { key: 'actionDate', label: 'Action Date' },
    { key: 'actionType', label: 'Action Type' },
    { key: 'actionBy', label: 'Action By' },
    { key: 'vendorName', label: 'Vendor', resolveFrom: { apiBasePath: 'master/vendor', fromField: 'vendorId', toField: 'vendorId', labelField: 'vendorName' } },
    { key: 'vendorStaffCode', label: 'Code' },
    { key: 'fullName', label: 'Name' },
    { key: 'isActive', label: 'Active' },
  ],
  buildDeleteRequest: (row) => ({ vendorStaffId: row['vendorStaffId'] }),
  buildListRequest: (searchText) => ({ searchText: searchText || null, isActive: null }),
  buildHistoryRequest: (row) => ({ vendorStaffId: row['vendorStaffId'] }),
};
