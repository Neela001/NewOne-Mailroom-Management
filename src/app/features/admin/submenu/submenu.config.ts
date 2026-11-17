import { MasterEntityConfig } from '../../master/shared/master-entity-config.model';

// Fields from the live spec's SubMenuRequest/SubMenuGetRequest. menuUrl here
// is what MenuService's LoginUserRightRow.menuUrl must match for the
// sidebar's own routerLink to resolve correctly (see menu.service.ts).
//
// Column order below (Code, Name, Software, Main Menu, Vertical Menu, Form
// Name, Menu URL, Icon, Order) and the Software/Main Menu toolbar filters
// match the Windows reference app's own Submenu Master screen exactly — the
// real "Active" column is already appended automatically by
// master-list.component.html for every entity, not listed again here.
// extraFilters reuses the identical mechanism already built for Vertical
// Menu Master (softwareId/mainMenuId are real SubMenuGetRequest filter
// params, confirmed from the live spec), not a new pattern.
export const SUBMENU_CONFIG: MasterEntityConfig = {
  entityLabel: 'Sub Menu',
  entityLabelPlural: 'Sub Menus',
  apiBasePath: 'admin/submenu',
  idField: 'subMenuId',
  extraFilters: [
    { key: 'softwareId', label: 'Software', apiBasePath: 'admin/software', valueField: 'softwareId', labelField: 'softwareName' },
    { key: 'mainMenuId', label: 'Main Menu', apiBasePath: 'admin/mainmenu', valueField: 'mainMenuId', labelField: 'mainMenuName' },
  ],
  columns: [
    { key: 'subMenuCode', label: 'Code', width: '150px' },
    { key: 'subMenuName', label: 'Name', width: '150px' },
    { key: 'softwareName', label: 'Software', width: '110px', resolveFrom: { apiBasePath: 'admin/software', fromField: 'softwareId', toField: 'softwareId', labelField: 'softwareName' } },
    { key: 'mainMenuName', label: 'Main Menu', width: '110px', resolveFrom: { apiBasePath: 'admin/mainmenu', fromField: 'mainMenuId', toField: 'mainMenuId', labelField: 'mainMenuName' } },
    { key: 'verticalMenuName', label: 'Vertical Menu', width: '130px', resolveFrom: { apiBasePath: 'admin/verticalmenu', fromField: 'verticalMenuId', toField: 'verticalMenuId', labelField: 'verticalMenuName' } },
    { key: 'formName', label: 'Form Name', width: '140px' },
    { key: 'menuUrl', label: 'Menu URL', width: '220px', truncate: true },
    { key: 'iconName', label: 'Icon', width: '110px' },
    { key: 'displayOrder', label: 'Order', width: '70px' },
  ],
  formFields: [
    { key: 'softwareId', label: 'Software', type: 'select', optionsSource: { apiBasePath: 'admin/software', valueField: 'softwareId', labelField: 'softwareName' } },
    // Cascaded: both GetRequest schemas document real parent-id filters —
    // see master-entity-config.model.ts's own comment.
    {
      key: 'mainMenuId',
      label: 'Main Menu',
      type: 'select',
      required: true,
      optionsSource: { apiBasePath: 'admin/mainmenu', valueField: 'mainMenuId', labelField: 'mainMenuName', filterParams: { softwareId: 'softwareId' } },
    },
    {
      key: 'verticalMenuId',
      label: 'Vertical Menu',
      type: 'select',
      required: true,
      optionsSource: {
        apiBasePath: 'admin/verticalmenu',
        valueField: 'verticalMenuId',
        labelField: 'verticalMenuName',
        filterParams: { softwareId: 'softwareId', mainMenuId: 'mainMenuId' },
      },
    },
    { key: 'subMenuCode', label: 'Menu Code', type: 'text', required: true },
    { key: 'subMenuName', label: 'Menu Name', type: 'text', required: true },
    { key: 'menuUrl', label: 'Menu URL', type: 'text' },
    { key: 'formName', label: 'Form Name', type: 'text' },
    { key: 'iconName', label: 'Icon Name', type: 'text' },
    { key: 'displayOrder', label: 'Display Order', type: 'number' },
    { key: 'isCommon', label: 'Common (all roles)', type: 'boolean' },
    { key: 'remarks', label: 'Remarks', type: 'textarea', fullRow: true },
  ],
  historyColumns: [
    { key: 'actionDate', label: 'Action Date' },
    { key: 'actionType', label: 'Action Type' },
    { key: 'actionBy', label: 'Action By' },
    { key: 'verticalMenuName', label: 'Vertical Menu', resolveFrom: { apiBasePath: 'admin/verticalmenu', fromField: 'verticalMenuId', toField: 'verticalMenuId', labelField: 'verticalMenuName' } },
    { key: 'subMenuCode', label: 'Code' },
    { key: 'subMenuName', label: 'Name' },
    { key: 'isActive', label: 'Active' },
  ],
  buildDeleteRequest: (row) => ({ subMenuId: row['subMenuId'] }),
  buildListRequest: (searchText, extraFilterValues) => ({
    searchText: searchText || null,
    isActive: null,
    softwareId: extraFilterValues?.['softwareId'] || null,
    mainMenuId: extraFilterValues?.['mainMenuId'] || null,
  }),
  buildHistoryRequest: (row) => ({ subMenuId: row['subMenuId'] }),
};
