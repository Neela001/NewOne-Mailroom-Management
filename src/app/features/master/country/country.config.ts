import { MasterEntityConfig } from '../shared/master-entity-config.model';

// Fields copied field-for-field from the live spec's CountryRequest /
// CountryGetRequest / CountryHistoryResponse schemas (GET
// https://newoneapi.nestien.com/swagger/v1/swagger.json) — nothing guessed.
// apiBasePath "master/country" matches POST .../master/country/{add,edit,delete,get,history/get}.
export const COUNTRY_CONFIG: MasterEntityConfig = {
  entityLabel: 'Country',
  entityLabelPlural: 'Countries',
  apiBasePath: 'master/country',
  idField: 'countryId',
  columns: [
    { key: 'countryCode', label: 'Code' },
    { key: 'countryName', label: 'Name' },
    { key: 'isdCode', label: 'ISD Code' },
    { key: 'hasState', label: 'State', boolean: true },
    { key: 'hasCity', label: 'City', boolean: true },
    { key: 'hasPostalCode', label: 'Postal', boolean: true },
    { key: 'hasArea', label: 'Area', boolean: true },
    { key: 'stateLabel', label: 'State Label' },
    { key: 'postalCodeLabel', label: 'Postal Label' },
  ],
  formFields: [
    { key: 'countryCode', label: 'Country Code', type: 'text', required: true },
    { key: 'countryName', label: 'Country Name', type: 'text', required: true },
    { key: 'isdCode', label: 'ISD Code', type: 'text' },
    { key: 'hasState', label: 'Has State', type: 'boolean' },
    { key: 'hasCity', label: 'Has City', type: 'boolean' },
    { key: 'hasPostalCode', label: 'Has Postal Code', type: 'boolean' },
    { key: 'hasArea', label: 'Has Area', type: 'boolean' },
    { key: 'stateLabel', label: 'State Label', type: 'text' },
    { key: 'postalCodeLabel', label: 'Postal Code Label', type: 'text' },
    { key: 'remarks', label: 'Remarks', type: 'textarea', fullRow: true },
  ],
  historyColumns: [
    { key: 'actionDate', label: 'Action Date' },
    { key: 'actionType', label: 'Action Type' },
    { key: 'actionBy', label: 'Action By' },
    { key: 'countryCode', label: 'Code' },
    { key: 'countryName', label: 'Name' },
    { key: 'isdCode', label: 'ISD Code' },
    { key: 'hasState', label: 'State' },
    { key: 'hasCity', label: 'City' },
    { key: 'hasPostalCode', label: 'Postal' },
    { key: 'hasArea', label: 'Area' },
    { key: 'stateLabel', label: 'State Label' },
    { key: 'postalCodeLabel', label: 'Postal Label' },
    { key: 'isActive', label: 'Active' },
    { key: 'remarks', label: 'Remarks' },
  ],
  buildDeleteRequest: (row) => ({ countryId: row['countryId'] }),
  buildListRequest: (searchText) => ({ searchText: searchText || null, isActive: null }),
  buildHistoryRequest: (row) => ({ countryId: row['countryId'] }),
};
