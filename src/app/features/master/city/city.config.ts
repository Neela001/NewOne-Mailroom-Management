import { MasterEntityConfig } from '../shared/master-entity-config.model';

// Fields from the live spec's CityRequest/CityGetRequest.
export const CITY_CONFIG: MasterEntityConfig = {
  entityLabel: 'City',
  entityLabelPlural: 'Cities',
  apiBasePath: 'master/city',
  idField: 'cityId',
  columns: [
    { key: 'countryCode', label: 'Country Code', resolveFrom: { apiBasePath: 'master/country', fromField: 'countryId', toField: 'countryId', labelField: 'countryCode' } },
    { key: 'countryName', label: 'Country Name', resolveFrom: { apiBasePath: 'master/country', fromField: 'countryId', toField: 'countryId', labelField: 'countryName' } },
    { key: 'stateCode', label: 'State Code', resolveFrom: { apiBasePath: 'master/state', fromField: 'stateId', toField: 'stateId', labelField: 'stateCode' } },
    { key: 'stateName', label: 'State Name', resolveFrom: { apiBasePath: 'master/state', fromField: 'stateId', toField: 'stateId', labelField: 'stateName' } },
    { key: 'cityCode', label: 'City Code' },
    { key: 'cityName', label: 'City Name' },
  ],
  formFields: [
    { key: 'countryId', label: 'Country', type: 'select', required: true, optionsSource: { apiBasePath: 'master/country', valueField: 'countryId', labelField: 'countryName' } },
    { key: 'stateId', label: 'State', type: 'select', required: true, optionsSource: { apiBasePath: 'master/state', valueField: 'stateId', labelField: 'stateName' } },
    { key: 'cityCode', label: 'City Code', type: 'text' },
    { key: 'cityName', label: 'City Name', type: 'text', required: true },
    { key: 'remarks', label: 'Remarks', type: 'textarea', fullRow: true },
  ],
  historyColumns: [
    { key: 'actionDate', label: 'Action Date' },
    { key: 'actionType', label: 'Action Type' },
    { key: 'actionBy', label: 'Action By' },
    { key: 'countryName', label: 'Country', resolveFrom: { apiBasePath: 'master/country', fromField: 'countryId', toField: 'countryId', labelField: 'countryName' } },
    { key: 'stateName', label: 'State', resolveFrom: { apiBasePath: 'master/state', fromField: 'stateId', toField: 'stateId', labelField: 'stateName' } },
    { key: 'cityCode', label: 'City Code' },
    { key: 'cityName', label: 'City Name' },
    { key: 'isActive', label: 'Active' },
  ],
  buildDeleteRequest: (row) => ({ cityId: row['cityId'] }),
  buildListRequest: (searchText) => ({ searchText: searchText || null, isActive: null }),
  buildHistoryRequest: (row) => ({ cityId: row['cityId'] }),
};
