import { MasterEntityConfig } from '../../master/shared/master-entity-config.model';

// Fields from the live spec's CourierVendorRequest/CourierVendorGetRequest.
// vendorType/serviceType are real string fields with no documented fixed
// enum in the spec (confirmed live values: VendorType "BOTH"/
// "INBOUND_ONLY", ServiceType "DOMESTIC"/"BOTH") — shown here as a static
// option list for the View Data tab's own label resolution only (see
// couriervendor.model.ts's own comment for the full confirmed-live
// writeup and why no backend options source exists for either field).
// deskIds (multi-desk assignment) and the separate contact/desk
// sub-resources are NOT exposed here — no multi-select field type exists
// in this shared form model; see couriervendor-form-dialog.component.ts's
// own comment for why Add/Edit needed a dedicated 3-tab dialog instead.
// COURIERVENDOR_CONFIG is kept and reused here ONLY for the "View /
// History" action.
export const COURIERVENDOR_CONFIG: MasterEntityConfig = {
  entityLabel: 'Courier Vendor',
  entityLabelPlural: 'Courier Vendors',
  apiBasePath: 'master/couriervendor',
  idField: 'courierVendorId',
  columns: [
    { key: 'vendorCode', label: 'Code' },
    { key: 'vendorName', label: 'Name' },
    { key: 'modeName', label: 'Mode' },
    { key: 'vendorTypeLabel', label: 'Vendor Type' },
    { key: 'serviceTypeLabel', label: 'Service Type' },
  ],
  formFields: [
    { key: 'vendorCode', label: 'Vendor Code', type: 'text', required: true },
    { key: 'vendorName', label: 'Vendor Name', type: 'text', required: true },
    { key: 'courierModeId', label: 'Mode', type: 'select', required: true, optionsSource: { apiBasePath: 'master/couriermode', valueField: 'courierModeId', labelField: 'modeName' } },
    {
      key: 'vendorType',
      label: 'Vendor Type',
      type: 'select',
      options: [
        { label: 'Both', value: 'BOTH' },
        { label: 'Inbound Only', value: 'INBOUND_ONLY' },
      ],
    },
    {
      key: 'serviceType',
      label: 'Service Type',
      type: 'select',
      options: [
        { label: 'Domestic', value: 'DOMESTIC' },
        { label: 'Both', value: 'BOTH' },
      ],
    },
    { key: 'trackingUrl', label: 'Tracking URL', type: 'text' },
    { key: 'remarks', label: 'Remarks', type: 'textarea', fullRow: true },
  ],
  historyColumns: [
    { key: 'actionDate', label: 'Action Date' },
    { key: 'actionType', label: 'Action Type' },
    { key: 'actionBy', label: 'Action By' },
    { key: 'vendorCode', label: 'Code' },
    { key: 'vendorName', label: 'Name' },
    { key: 'isActive', label: 'Active' },
  ],
  buildDeleteRequest: (row) => ({ courierVendorId: row['courierVendorId'] }),
  buildListRequest: (searchText) => ({ searchText: searchText || null, isActive: null }),
  buildHistoryRequest: (row) => ({ courierVendorId: row['courierVendorId'] }),
  // CONFIRMED LIVE: master/couriervendor/history/get has no typed
  // CourierVendorHistoryResponse schema in the real Swagger spec (only a
  // CourierVendorHistoryGetRequest for the input) — same untyped, raw-
  // PascalCase response shape confirmed for Courier Mode/Email Setting/
  // Desk/Upload Master this session (see master-entity-config.model.ts's
  // own comment for the full root-cause writeup).
  historyRowsArePascalCase: true,
};
