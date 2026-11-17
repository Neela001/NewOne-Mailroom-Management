import { MasterEntityConfig } from '../shared/master-entity-config.model';

// Fields from the live spec's PostalcodeRequest/PostalcodeGetRequest.
export const POSTALCODE_CONFIG: MasterEntityConfig = {
  entityLabel: 'Postal Code',
  entityLabelPlural: 'Postal Codes',
  apiBasePath: 'master/postalcode',
  idField: 'postalCodeId',
  columns: [
    { key: 'countryCode', label: 'Country Code', resolveFrom: { apiBasePath: 'master/country', fromField: 'countryId', toField: 'countryId', labelField: 'countryCode' } },
    { key: 'countryName', label: 'Country Name', resolveFrom: { apiBasePath: 'master/country', fromField: 'countryId', toField: 'countryId', labelField: 'countryName' } },
    { key: 'stateCode', label: 'State Code', resolveFrom: { apiBasePath: 'master/state', fromField: 'stateId', toField: 'stateId', labelField: 'stateCode' } },
    { key: 'stateName', label: 'State Name', resolveFrom: { apiBasePath: 'master/state', fromField: 'stateId', toField: 'stateId', labelField: 'stateName' } },
    { key: 'cityCode', label: 'City Code', resolveFrom: { apiBasePath: 'master/city', fromField: 'cityId', toField: 'cityId', labelField: 'cityCode' } },
    { key: 'cityName', label: 'City Name', resolveFrom: { apiBasePath: 'master/city', fromField: 'cityId', toField: 'cityId', labelField: 'cityName' } },
    { key: 'postalCode', label: 'Postal Code' },
  ],
  formFields: [
    { key: 'countryId', label: 'Country', type: 'select', required: true, optionsSource: { apiBasePath: 'master/country', valueField: 'countryId', labelField: 'countryName' } },
    { key: 'stateId', label: 'State', type: 'select', optionsSource: { apiBasePath: 'master/state', valueField: 'stateId', labelField: 'stateName' } },
    { key: 'cityId', label: 'City', type: 'select', optionsSource: { apiBasePath: 'master/city', valueField: 'cityId', labelField: 'cityName' } },
    { key: 'postalCode', label: 'Postal Code', type: 'text', required: true },
    { key: 'remarks', label: 'Remarks', type: 'textarea', fullRow: true },
  ],
  historyColumns: [
    { key: 'actionDate', label: 'Action Date' },
    { key: 'actionType', label: 'Action Type' },
    { key: 'actionBy', label: 'Action By' },
    { key: 'countryName', label: 'Country', resolveFrom: { apiBasePath: 'master/country', fromField: 'countryId', toField: 'countryId', labelField: 'countryName' } },
    { key: 'stateName', label: 'State', resolveFrom: { apiBasePath: 'master/state', fromField: 'stateId', toField: 'stateId', labelField: 'stateName' } },
    { key: 'cityName', label: 'City', resolveFrom: { apiBasePath: 'master/city', fromField: 'cityId', toField: 'cityId', labelField: 'cityName' } },
    { key: 'postalCode', label: 'Postal Code' },
    { key: 'isActive', label: 'Active' },
  ],
  buildDeleteRequest: (row) => ({ postalCodeId: row['postalCodeId'] }),
  buildListRequest: (searchText) => ({ searchText: searchText || null, isActive: null }),
  buildHistoryRequest: (row) => ({ postalCodeId: row['postalCodeId'] }),
};
