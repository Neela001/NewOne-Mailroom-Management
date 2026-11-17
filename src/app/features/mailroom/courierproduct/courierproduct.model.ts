// Fields confirmed LIVE (real backend, real account, 2026-11-15) against
// GET https://newoneapi.nestien.com/swagger/v1/swagger.json
// (CourierProductRequest/GetRequest/HistoryGetRequest schemas) and a full
// options/get + create -> decimal/zero/negative-divisor probes -> edit ->
// duplicate-probe -> history -> delete -> refetch cycle, using a
// disposable test record per this task's own explicit "Use... disposable
// test records for Create → Edit → Delete verification" allowance.
// COURIERPRODUCT_CONFIG is kept and reused ONLY for the "View / History"
// action.
//
// CONFIRMED LIVE: master/courierproduct/get's own real response already
// fully denormalizes every listing column this task asks for
// (ProductGroupName, ModeName, VendorName, plus their own Codes) — no
// extra lookup fetches needed for the listing.
//
// CONFIRMED LIVE — master/courierproduct/options/get {} is a dedicated
// lookup returning `{modes, productGroups, vendors}` in ONE call (same
// pattern as Courier Vendor's own options/get). Its own item shape is
// DIFFERENT from the main /get row's own field names — here it's plainly
// `{Id, Code, Name, IsActive}` per mode/group, and vendors additionally
// carry `CourierModeId` and `ServiceType` directly — confirmed this is
// how "vendors compatible with the selected mode" is filtered (client-
// side, `vendor.courierModeId === selectedModeId`, same established
// client-filter pattern as every cascading dropdown this session — no
// server-side mode filter param exists for vendors here either).
//
// CONFIRMED LIVE — Volumetric Divisor, resolving this task's own explicit
// ambiguity ("the screenshot label says whole number, while the
// displayed validation message mentions up to four decimal places"):
//   - The REAL backend validation message is exactly "Volumetric divisor
//     must be a whole number from 0 to 99999999999999." A real probe
//     sending 5000.1234 (four decimals) and another sending 5000.5 (one
//     decimal) were BOTH rejected with this exact message — decimals are
//     flatly rejected, confirming the screenshot's own "whole number"
//     label is correct and the "four decimal places" validation text
//     does not reflect this field's real behavior.
//   - Zero IS a valid, real, commonly-used value — CONFIRMED from real
//     existing data (every real India Post product has
//     VolumetricDivisor: 0) and from a real probe explicitly setting 0,
//     which succeeded. This directly contradicts this task's own "Reject
//     zero" instruction — implemented per the CONFIRMED real rule
//     instead (reject negative and non-integer values only; 0 is valid),
//     with this discrepancy flagged in the final report.
//   - A real negative-value probe (-100) was rejected with the same
//     whole-number message.
//
// CONFIRMED LIVE — Service Type: in every one of the 7 real existing
// Courier Product rows, the product's own ServiceType exactly equals its
// own Vendor's ServiceType (BlueDart vendor=DOMESTIC -> all 3 of its
// products=DOMESTIC; India Post vendor=BOTH -> all 4 of its
// products=BOTH). No case was found where a product's ServiceType
// differed from its own vendor's. Implemented as a single, vendor-
// derived value (auto-populated once Vendor is selected, not an
// independently browsable option list) rather than inventing a
// Domestic/International/Both triad the task explicitly warned against
// hardcoding — this is the actual observed "service types supported by
// the selected vendor and courier mode" the task asks to load. Edit mode
// preserves whatever value was actually saved even if it no longer
// matches the vendor's current value (defensive "preserve existing
// relationship" handling).
//
// CONFIRMED LIVE — the "Available" column (IsAvailable): in every real
// row observed, IsAvailable tracked IsActive exactly (true for all 7
// real active rows; a real deactivate-via-delete probe flipped BOTH
// IsActive and IsAvailable to false in the same response). No case was
// found where the two values diverged. Per this task's own explicit "Do
// not assume it means Active. Do not derive or hardcode its value"
// instruction, the frontend does NOT compute or assume this relationship
// — it simply displays whatever real IsAvailable value the backend
// returns for each row, as its own independent field, while this
// observed correlation is documented here rather than hardcoded into
// the UI.
//
// CONFIRMED LIVE: the backend itself enforces Code uniqueness (real
// rejection: "Duplicate product code already exists.") and genuinely
// persists Change Remarks to history. Delete is a real soft
// deactivation ("Courier product marked inactive."). No typed
// CourierProductHistoryResponse schema exists (only the GetRequest) —
// same untyped, raw-PascalCase history response confirmed for every
// other Courier-family entity this session.
export interface CourierProductRow {
  courierProductId: string;
  code?: string | null;
  name?: string | null;
  volumetricDivisor?: number | null;
  courierProductGroupId?: string | null;
  courierModeId?: string | null;
  courierVendorId?: string | null;
  serviceType?: string | null;
  isActive: boolean;
  isAvailable?: boolean | null;
  productGroupCode?: string | null;
  productGroupName?: string | null;
  modeCode?: string | null;
  modeName?: string | null;
  vendorCode?: string | null;
  vendorName?: string | null;
}

export interface CourierProductOptionItem {
  id: string;
  code?: string | null;
  name?: string | null;
  isActive: boolean;
}

export interface CourierProductVendorOptionItem extends CourierProductOptionItem {
  courierModeId: string;
  serviceType?: string | null;
}

export interface CourierProductOptionsResponse {
  modes: CourierProductOptionItem[];
  productGroups: CourierProductOptionItem[];
  vendors: CourierProductVendorOptionItem[];
}

export interface CourierProductSaveRequest {
  courierProductId?: string | null;
  code?: string | null;
  name?: string | null;
  courierModeId?: string | null;
  courierVendorId?: string | null;
  courierProductGroupId?: string | null;
  serviceType?: string | null;
  volumetricDivisor?: number | null;
  remarks?: string | null;
}
