import { MasterEntityConfig } from '../../master/shared/master-entity-config.model';

// Fields from the live spec's SoftwareRequest/SoftwareGetRequest.
export const SOFTWARE_CONFIG: MasterEntityConfig = {
  entityLabel: 'Software',
  entityLabelPlural: 'Software',
  apiBasePath: 'admin/software',
  idField: 'softwareId',
  columns: [
    { key: 'softwareCode', label: 'Code' },
    { key: 'softwareName', label: 'Name' },
  ],
  formFields: [
    { key: 'softwareCode', label: 'Software Code', type: 'text', required: true },
    { key: 'softwareName', label: 'Software Name', type: 'text', required: true },
    { key: 'softwareDescription', label: 'Description', type: 'text' },
    { key: 'remarks', label: 'Remarks', type: 'textarea', fullRow: true },
  ],
  historyColumns: [
    { key: 'softwareCode', label: 'Code' },
    { key: 'softwareName', label: 'Name' },
    { key: 'isActive', label: 'Active' },
    { key: 'actionType', label: 'Action' },
    { key: 'actionBy', label: 'By' },
    { key: 'actionDate', label: 'Date' },
  ],
  buildDeleteRequest: (row) => ({ softwareId: row['softwareId'] }),
  buildListRequest: (searchText) => ({ searchText: searchText || null, isActive: null }),
  buildHistoryRequest: (row) => ({ softwareId: row['softwareId'] }),
};
