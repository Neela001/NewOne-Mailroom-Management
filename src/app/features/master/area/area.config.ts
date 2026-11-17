import { MasterEntityConfig } from '../shared/master-entity-config.model';

// Fields from the live spec's AreaRequest/AreaGetRequest.
export const AREA_CONFIG: MasterEntityConfig = {
  entityLabel: 'Area',
  entityLabelPlural: 'Areas',
  apiBasePath: 'master/area',
  idField: 'areaId',
  columns: [
    { key: 'countryCode', label: 'Country Code', resolveFrom: { apiBasePath: 'master/country', fromField: 'countryId', toField: 'countryId', labelField: 'countryCode' } },
    { key: 'countryName', label: 'Country Name', resolveFrom: { apiBasePath: 'master/country', fromField: 'countryId', toField: 'countryId', labelField: 'countryName' } },
    { key: 'stateName', label: 'State Name', resolveFrom: { apiBasePath: 'master/state', fromField: 'stateId', toField: 'stateId', labelField: 'stateName' } },
    { key: 'cityName', label: 'City Name', resolveFrom: { apiBasePath: 'master/city', fromField: 'cityId', toField: 'cityId', labelField: 'cityName' } },
    { key: 'postalCode', label: 'Postal Code', resolveFrom: { apiBasePath: 'master/postalcode', fromField: 'postalCodeId', toField: 'postalCodeId', labelField: 'postalCode' } },
    { key: 'areaCode', label: 'Area Code' },
    { key: 'areaName', label: 'Area Name' },
  ],
  formFields: [
    { key: 'countryId', label: 'Country', type: 'select', required: true, optionsSource: { apiBasePath: 'master/country', valueField: 'countryId', labelField: 'countryName' } },
    { key: 'stateId', label: 'State', type: 'select', optionsSource: { apiBasePath: 'master/state', valueField: 'stateId', labelField: 'stateName' } },
    { key: 'cityId', label: 'City', type: 'select', optionsSource: { apiBasePath: 'master/city', valueField: 'cityId', labelField: 'cityName' } },
    { key: 'postalCodeId', label: 'Postal Code', type: 'select', optionsSource: { apiBasePath: 'master/postalcode', valueField: 'postalCodeId', labelField: 'postalCode' } },
    { key: 'areaCode', label: 'Area Code', type: 'text' },
    { key: 'areaName', label: 'Area Name', type: 'text', required: true },
    { key: 'remarks', label: 'Remarks', type: 'textarea', fullRow: true },
  ],
  historyColumns: [
    { key: 'actionDate', label: 'Action Date' },
    { key: 'actionType', label: 'Action Type' },
    { key: 'actionBy', label: 'Action By' },
    { key: 'countryName', label: 'Country', resolveFrom: { apiBasePath: 'master/country', fromField: 'countryId', toField: 'countryId', labelField: 'countryName' } },
    { key: 'stateName', label: 'State', resolveFrom: { apiBasePath: 'master/state', fromField: 'stateId', toField: 'stateId', labelField: 'stateName' } },
    { key: 'cityName', label: 'City', resolveFrom: { apiBasePath: 'master/city', fromField: 'cityId', toField: 'cityId', labelField: 'cityName' } },
    { key: 'postalCode', label: 'Postal Code', resolveFrom: { apiBasePath: 'master/postalcode', fromField: 'postalCodeId', toField: 'postalCodeId', labelField: 'postalCode' } },
    { key: 'areaCode', label: 'Area Code' },
    { key: 'areaName', label: 'Area Name' },
    { key: 'isActive', label: 'Active' },
  ],
  buildDeleteRequest: (row) => ({ areaId: row['areaId'] }),
  buildListRequest: (searchText) => ({ searchText: searchText || null, isActive: null }),
  buildHistoryRequest: (row) => ({ areaId: row['areaId'] }),
};
