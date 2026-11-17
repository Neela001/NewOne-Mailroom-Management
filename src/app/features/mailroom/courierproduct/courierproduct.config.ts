import { MasterEntityConfig } from '../../master/shared/master-entity-config.model';

// Fields from the live spec's CourierProductRequest/CourierProductGetRequest.
// serviceType kept as free text (no documented fixed enum — see
// couriervendor.config.ts's own comment for why). COURIERPRODUCT_CONFIG
// is kept and reused ONLY for the "View / History" action — see
// courierproduct-list.component.ts's own comment for why Add/Edit needed
// a dedicated dialog instead.
export const COURIERPRODUCT_CONFIG: MasterEntityConfig = {
  entityLabel: 'Courier Product',
  entityLabelPlural: 'Courier Products',
  apiBasePath: 'master/courierproduct',
  idField: 'courierProductId',
  columns: [
    { key: 'code', label: 'Code' },
    { key: 'name', label: 'Name' },
    { key: 'productGroupName', label: 'Product Group' },
    { key: 'modeName', label: 'Mode' },
    { key: 'vendorName', label: 'Vendor' },
    { key: 'serviceTypeLabel', label: 'Service Type' },
  ],
  formFields: [
    { key: 'code', label: 'Code', type: 'text', required: true },
    { key: 'name', label: 'Name', type: 'text', required: true },
    { key: 'courierProductGroupId', label: 'Product Group', type: 'select', required: true, optionsSource: { apiBasePath: 'master/courierproductgroup', valueField: 'courierProductGroupId', labelField: 'name' } },
    { key: 'courierModeId', label: 'Mode', type: 'select', required: true, optionsSource: { apiBasePath: 'master/couriermode', valueField: 'courierModeId', labelField: 'modeName' } },
    { key: 'courierVendorId', label: 'Vendor', type: 'select', optionsSource: { apiBasePath: 'master/couriervendor', valueField: 'courierVendorId', labelField: 'vendorName' } },
    { key: 'serviceType', label: 'Service Type', type: 'text' },
    { key: 'volumetricDivisor', label: 'Volumetric Divisor', type: 'number' },
    { key: 'remarks', label: 'Remarks', type: 'textarea', fullRow: true },
  ],
  historyColumns: [
    { key: 'actionDate', label: 'Action Date' },
    { key: 'actionType', label: 'Action Type' },
    { key: 'actionBy', label: 'Action By' },
    { key: 'code', label: 'Code' },
    { key: 'name', label: 'Name' },
    { key: 'volumetricDivisor', label: 'Volumetric Divisor' },
    { key: 'isActive', label: 'Active' },
    { key: 'remarks', label: 'Remarks' },
  ],
  buildDeleteRequest: (row) => ({ courierProductId: row['courierProductId'] }),
  buildListRequest: (searchText) => ({ searchText: searchText || null, isActive: null }),
  buildHistoryRequest: (row) => ({ courierProductId: row['courierProductId'] }),
  // CONFIRMED LIVE: master/courierproduct/history/get has no typed
  // CourierProductHistoryResponse schema in the real Swagger spec (only
  // a CourierProductHistoryGetRequest for the input) — same untyped,
  // raw-PascalCase response shape confirmed for every other Courier-
  // family entity this session (see master-entity-config.model.ts's own
  // comment for the full root-cause writeup).
  historyRowsArePascalCase: true,
};
