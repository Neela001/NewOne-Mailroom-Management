import { MasterEntityConfig } from '../../master/shared/master-entity-config.model';

// Fields from the live spec's CourierProductGroupRequest/GetRequest,
// confirmed against a real authenticated get response (4 live rows:
// DP/Doc Air, NDA/Non Doc Air, POSTAL/Postal, NDS/Surface).
// COURIERPRODUCTGROUP_CONFIG is kept and reused ONLY for the "View /
// History" action — see courierproductgroup-list.component.ts's own
// comment for why Add/Edit needed a dedicated dialog instead.
export const COURIERPRODUCTGROUP_CONFIG: MasterEntityConfig = {
  entityLabel: 'Courier Product Group',
  entityLabelPlural: 'Courier Product Groups',
  apiBasePath: 'master/courierproductgroup',
  idField: 'courierProductGroupId',
  columns: [
    { key: 'code', label: 'Code' },
    { key: 'name', label: 'Name' },
  ],
  formFields: [
    { key: 'code', label: 'Code', type: 'text', required: true },
    { key: 'name', label: 'Name', type: 'text', required: true },
    { key: 'remarks', label: 'Remarks', type: 'textarea', fullRow: true },
  ],
  historyColumns: [
    { key: 'actionDate', label: 'Action Date' },
    { key: 'actionType', label: 'Action Type' },
    { key: 'actionBy', label: 'Action By' },
    { key: 'code', label: 'Code' },
    { key: 'name', label: 'Name' },
    { key: 'isActive', label: 'Active' },
    // CONFIRMED LIVE (courierproductgroup.model.ts's own comment):
    // Remarks sent on add/edit are genuinely persisted and returned on
    // the matching history/get row.
    { key: 'remarks', label: 'Remarks' },
  ],
  buildDeleteRequest: (row) => ({ courierProductGroupId: row['courierProductGroupId'] }),
  buildListRequest: (searchText) => ({ searchText: searchText || null, isActive: null }),
  buildHistoryRequest: (row) => ({ courierProductGroupId: row['courierProductGroupId'] }),
  // CONFIRMED LIVE: master/courierproductgroup/history/get has no typed
  // CourierProductGroupHistoryResponse schema in the real Swagger spec
  // (only a CourierProductGroupHistoryGetRequest for the input) — same
  // untyped, raw-PascalCase response shape confirmed for Courier Mode/
  // Courier Vendor/Email Setting/Desk/Upload Master this session (see
  // master-entity-config.model.ts's own comment for the full root-cause
  // writeup).
  historyRowsArePascalCase: true,
};
