import { MasterEntityConfig } from '../shared/master-entity-config.model';

// Fields from the live spec's SiteRequest/SiteGetRequest.
export const SITE_CONFIG: MasterEntityConfig = {
  entityLabel: 'Site',
  entityLabelPlural: 'Sites',
  apiBasePath: 'master/site',
  idField: 'siteId',
  columns: [
    { key: 'countryName', label: 'Country', resolveFrom: { apiBasePath: 'master/country', fromField: 'countryId', toField: 'countryId', labelField: 'countryName' } },
    { key: 'stateName', label: 'State', resolveFrom: { apiBasePath: 'master/state', fromField: 'stateId', toField: 'stateId', labelField: 'stateName' } },
    { key: 'cityName', label: 'City', resolveFrom: { apiBasePath: 'master/city', fromField: 'cityId', toField: 'cityId', labelField: 'cityName' } },
    { key: 'areaName', label: 'Area', resolveFrom: { apiBasePath: 'master/area', fromField: 'areaId', toField: 'areaId', labelField: 'areaName' } },
    { key: 'siteCode', label: 'Code' },
    { key: 'siteName', label: 'Name' },
  ],
  formFields: [
    { key: 'countryId', label: 'Country', type: 'select', optionsSource: { apiBasePath: 'master/country', valueField: 'countryId', labelField: 'countryName' } },
    { key: 'stateId', label: 'State', type: 'select', optionsSource: { apiBasePath: 'master/state', valueField: 'stateId', labelField: 'stateName' } },
    { key: 'cityId', label: 'City', type: 'select', optionsSource: { apiBasePath: 'master/city', valueField: 'cityId', labelField: 'cityName' } },
    { key: 'postalCodeId', label: 'Postal Code', type: 'select', optionsSource: { apiBasePath: 'master/postalcode', valueField: 'postalCodeId', labelField: 'postalCode' } },
    { key: 'areaId', label: 'Area', type: 'select', optionsSource: { apiBasePath: 'master/area', valueField: 'areaId', labelField: 'areaName' } },
    { key: 'siteCode', label: 'Site Code', type: 'text', required: true },
    { key: 'siteName', label: 'Site Name', type: 'text', required: true },
    { key: 'remarks', label: 'Remarks', type: 'textarea', fullRow: true },
  ],
  historyColumns: [
    { key: 'actionDate', label: 'Action Date' },
    { key: 'actionType', label: 'Action Type' },
    { key: 'actionBy', label: 'Action By' },
    { key: 'countryName', label: 'Country', resolveFrom: { apiBasePath: 'master/country', fromField: 'countryId', toField: 'countryId', labelField: 'countryName' } },
    { key: 'stateName', label: 'State', resolveFrom: { apiBasePath: 'master/state', fromField: 'stateId', toField: 'stateId', labelField: 'stateName' } },
    { key: 'cityName', label: 'City', resolveFrom: { apiBasePath: 'master/city', fromField: 'cityId', toField: 'cityId', labelField: 'cityName' } },
    { key: 'siteCode', label: 'Code' },
    { key: 'siteName', label: 'Name' },
    { key: 'isActive', label: 'Active' },
  ],
  buildDeleteRequest: (row) => ({ siteId: row['siteId'] }),
  buildListRequest: (searchText) => ({ searchText: searchText || null, isActive: null }),
  buildHistoryRequest: (row) => ({ siteId: row['siteId'] }),
};
