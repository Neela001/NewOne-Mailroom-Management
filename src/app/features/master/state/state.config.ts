import { MasterEntityConfig } from '../shared/master-entity-config.model';

// Fields from the live spec's StateRequest/StateGetRequest.
export const STATE_CONFIG: MasterEntityConfig = {
  entityLabel: 'State',
  entityLabelPlural: 'States',
  apiBasePath: 'master/state',
  idField: 'stateId',
  columns: [
    { key: 'countryCode', label: 'Country Code', resolveFrom: { apiBasePath: 'master/country', fromField: 'countryId', toField: 'countryId', labelField: 'countryCode' } },
    { key: 'countryName', label: 'Country Name', resolveFrom: { apiBasePath: 'master/country', fromField: 'countryId', toField: 'countryId', labelField: 'countryName' } },
    { key: 'stateCode', label: 'State Code' },
    { key: 'stateName', label: 'State Name' },
  ],
  formFields: [
    { key: 'countryId', label: 'Country', type: 'select', required: true, optionsSource: { apiBasePath: 'master/country', valueField: 'countryId', labelField: 'countryName' } },
    { key: 'stateCode', label: 'State Code', type: 'text' },
    { key: 'stateName', label: 'State Name', type: 'text', required: true, fullRow: true },
    { key: 'remarks', label: 'Remarks', type: 'textarea', fullRow: true },
  ],
  historyColumns: [
    { key: 'actionDate', label: 'Action Date' },
    { key: 'actionType', label: 'Action Type' },
    { key: 'actionBy', label: 'Action By' },
    { key: 'countryName', label: 'Country', resolveFrom: { apiBasePath: 'master/country', fromField: 'countryId', toField: 'countryId', labelField: 'countryName' } },
    { key: 'stateCode', label: 'State Code' },
    { key: 'stateName', label: 'State Name' },
    { key: 'isActive', label: 'Active' },
  ],
  buildDeleteRequest: (row) => ({ stateId: row['stateId'] }),
  buildListRequest: (searchText) => ({ searchText: searchText || null, isActive: null }),
  buildHistoryRequest: (row) => ({ stateId: row['stateId'] }),
};
