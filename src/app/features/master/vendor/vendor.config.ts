import { MasterEntityConfig } from '../shared/master-entity-config.model';

// Fields from the live spec's VendorRequest/VendorGetRequest. Vendor is a
// new domain — no equivalent entity exists in the reference project.
export const VENDOR_CONFIG: MasterEntityConfig = {
  entityLabel: 'Vendor',
  entityLabelPlural: 'Vendors',
  apiBasePath: 'master/vendor',
  idField: 'vendorId',
  columns: [
    { key: 'vendorCode', label: 'Code' },
    { key: 'vendorName', label: 'Name' },
    { key: 'contactPerson', label: 'Contact Person' },
    { key: 'countryName', label: 'Country', resolveFrom: { apiBasePath: 'master/country', fromField: 'countryId', toField: 'countryId', labelField: 'countryName' } },
    { key: 'stateName', label: 'State', resolveFrom: { apiBasePath: 'master/state', fromField: 'stateId', toField: 'stateId', labelField: 'stateName' } },
    { key: 'cityName', label: 'City', resolveFrom: { apiBasePath: 'master/city', fromField: 'cityId', toField: 'cityId', labelField: 'cityName' } },
  ],
  formFields: [
    { key: 'vendorCode', label: 'Vendor Code', type: 'text', required: true },
    { key: 'vendorName', label: 'Vendor Name', type: 'text', required: true },
    { key: 'contactPerson', label: 'Contact Person', type: 'text' },
    { key: 'phoneNo', label: 'Phone No', type: 'text' },
    { key: 'alternatePhoneNo', label: 'Alternate Phone No', type: 'text' },
    { key: 'emailId', label: 'Email', type: 'text' },
    { key: 'addressLine1', label: 'Address Line 1', type: 'text' },
    { key: 'addressLine2', label: 'Address Line 2', type: 'text' },
    { key: 'addressLine3', label: 'Address Line 3', type: 'text' },
    { key: 'countryId', label: 'Country', type: 'select', optionsSource: { apiBasePath: 'master/country', valueField: 'countryId', labelField: 'countryName' } },
    { key: 'stateId', label: 'State', type: 'select', optionsSource: { apiBasePath: 'master/state', valueField: 'stateId', labelField: 'stateName' } },
    { key: 'cityId', label: 'City', type: 'select', optionsSource: { apiBasePath: 'master/city', valueField: 'cityId', labelField: 'cityName' } },
    { key: 'postalCodeId', label: 'Postal Code', type: 'select', optionsSource: { apiBasePath: 'master/postalcode', valueField: 'postalCodeId', labelField: 'postalCode' } },
    { key: 'areaId', label: 'Area', type: 'select', optionsSource: { apiBasePath: 'master/area', valueField: 'areaId', labelField: 'areaName' } },
    { key: 'remarks', label: 'Remarks', type: 'textarea', fullRow: true },
  ],
  historyColumns: [
    { key: 'actionDate', label: 'Action Date' },
    { key: 'actionType', label: 'Action Type' },
    { key: 'actionBy', label: 'Action By' },
    { key: 'vendorCode', label: 'Code' },
    { key: 'vendorName', label: 'Name' },
    { key: 'countryName', label: 'Country', resolveFrom: { apiBasePath: 'master/country', fromField: 'countryId', toField: 'countryId', labelField: 'countryName' } },
    { key: 'stateName', label: 'State', resolveFrom: { apiBasePath: 'master/state', fromField: 'stateId', toField: 'stateId', labelField: 'stateName' } },
    { key: 'cityName', label: 'City', resolveFrom: { apiBasePath: 'master/city', fromField: 'cityId', toField: 'cityId', labelField: 'cityName' } },
    { key: 'isActive', label: 'Active' },
  ],
  buildDeleteRequest: (row) => ({ vendorId: row['vendorId'] }),
  buildListRequest: (searchText) => ({ searchText: searchText || null, isActive: null }),
  buildHistoryRequest: (row) => ({ vendorId: row['vendorId'] }),
};
