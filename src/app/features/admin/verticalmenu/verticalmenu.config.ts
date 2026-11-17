import { MasterEntityConfig } from '../../master/shared/master-entity-config.model';

// Fields from the live spec's VerticalMenuRequest/VerticalMenuGetRequest —
// confirmed live: VerticalMenuGetRequest documents real softwareId/
// mainMenuId filter params (see extraFilters below), matching the Windows
// reference app's own Vertical Menu Master toolbar (Software/Main Menu
// filter dropdowns) and table (Code/Name/Software/Main Menu/Icon/Order/
// Active, in that exact order).
export const VERTICALMENU_CONFIG: MasterEntityConfig = {
  entityLabel: 'Vertical Menu',
  entityLabelPlural: 'Vertical Menus',
  apiBasePath: 'admin/verticalmenu',
  idField: 'verticalMenuId',
  extraFilters: [
    { key: 'softwareId', label: 'Software', apiBasePath: 'admin/software', valueField: 'softwareId', labelField: 'softwareName' },
    { key: 'mainMenuId', label: 'Main Menu', apiBasePath: 'admin/mainmenu', valueField: 'mainMenuId', labelField: 'mainMenuName' },
  ],
  columns: [
    { key: 'verticalMenuCode', label: 'Code' },
    { key: 'verticalMenuName', label: 'Name' },
    { key: 'softwareName', label: 'Software', resolveFrom: { apiBasePath: 'admin/software', fromField: 'softwareId', toField: 'softwareId', labelField: 'softwareName' } },
    { key: 'mainMenuName', label: 'Main Menu', resolveFrom: { apiBasePath: 'admin/mainmenu', fromField: 'mainMenuId', toField: 'mainMenuId', labelField: 'mainMenuName' } },
    { key: 'iconName', label: 'Icon' },
    { key: 'displayOrder', label: 'Order' },
  ],
  formFields: [
    { key: 'softwareId', label: 'Software', type: 'select', optionsSource: { apiBasePath: 'admin/software', valueField: 'softwareId', labelField: 'softwareName' } },
    // Cascaded: MainMenuGetRequest documents a real softwareId filter — see
    // master-entity-config.model.ts's own comment.
    {
      key: 'mainMenuId',
      label: 'Main Menu',
      type: 'select',
      required: true,
      optionsSource: { apiBasePath: 'admin/mainmenu', valueField: 'mainMenuId', labelField: 'mainMenuName', filterParams: { softwareId: 'softwareId' } },
    },
    { key: 'verticalMenuCode', label: 'Menu Code', type: 'text', required: true },
    { key: 'verticalMenuName', label: 'Menu Name', type: 'text', required: true },
    { key: 'iconName', label: 'Icon Name', type: 'text' },
    { key: 'displayOrder', label: 'Display Order', type: 'number' },
    { key: 'isCommon', label: 'Common (all roles)', type: 'boolean' },
    { key: 'remarks', label: 'Remarks', type: 'textarea', fullRow: true },
  ],
  historyColumns: [
    { key: 'actionDate', label: 'Action Date' },
    { key: 'actionType', label: 'Action Type' },
    { key: 'actionBy', label: 'Action By' },
    { key: 'mainMenuName', label: 'Main Menu', resolveFrom: { apiBasePath: 'admin/mainmenu', fromField: 'mainMenuId', toField: 'mainMenuId', labelField: 'mainMenuName' } },
    { key: 'verticalMenuCode', label: 'Code' },
    { key: 'verticalMenuName', label: 'Name' },
    { key: 'isActive', label: 'Active' },
  ],
  buildDeleteRequest: (row) => ({ verticalMenuId: row['verticalMenuId'] }),
  buildListRequest: (searchText, extraFilterValues) => ({
    searchText: searchText || null,
    isActive: null,
    softwareId: extraFilterValues?.['softwareId'] || null,
    mainMenuId: extraFilterValues?.['mainMenuId'] || null,
  }),
  buildHistoryRequest: (row) => ({ verticalMenuId: row['verticalMenuId'] }),
};
