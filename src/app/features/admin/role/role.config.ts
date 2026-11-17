import { MasterEntityConfig } from '../../master/shared/master-entity-config.model';

// Fields from the live spec's RoleRequest/RoleGetRequest. The Software
// toolbar filter (before the search box, matching the Windows reference's
// own control order) and the Role Rights button (navigating to the already-
// real admin/rolerights screen, scoped to the selected role via its own
// roleId extraFilter — see rolerights.config.ts's own comment) reuse the
// same generic mechanisms Vertical Menu/Sub Menu Master's own toolbars
// already use, not a one-off for Role.
export const ROLE_CONFIG: MasterEntityConfig = {
  entityLabel: 'Role',
  entityLabelPlural: 'Roles',
  apiBasePath: 'admin/role',
  idField: 'roleId',
  extraFilters: [{ key: 'softwareId', label: 'Software', apiBasePath: 'admin/software', valueField: 'softwareId', labelField: 'softwareName' }],
  extraFiltersPosition: 'before-search',
  secondaryAction: { label: 'Role Rights', icon: 'admin_panel_settings', targetRoute: '/app/admin/rolerights', queryParamKey: 'roleId' },
  columns: [
    { key: 'roleCode', label: 'Code', width: '130px' },
    { key: 'roleName', label: 'Name', width: '160px' },
    { key: 'softwareName', label: 'Software', width: '140px', resolveFrom: { apiBasePath: 'admin/software', fromField: 'softwareId', toField: 'softwareId', labelField: 'softwareName' } },
    { key: 'roleDescription', label: 'Description', width: '320px', truncate: true },
  ],
  formFields: [
    { key: 'softwareId', label: 'Software', type: 'select', optionsSource: { apiBasePath: 'admin/software', valueField: 'softwareId', labelField: 'softwareName' } },
    { key: 'roleCode', label: 'Role Code', type: 'text', required: true },
    { key: 'roleName', label: 'Role Name', type: 'text', required: true },
    { key: 'roleDescription', label: 'Description', type: 'text' },
    { key: 'remarks', label: 'Remarks', type: 'textarea', fullRow: true },
  ],
  historyColumns: [
    { key: 'actionDate', label: 'Action Date' },
    { key: 'actionType', label: 'Action Type' },
    { key: 'actionBy', label: 'Action By' },
    { key: 'softwareName', label: 'Software', resolveFrom: { apiBasePath: 'admin/software', fromField: 'softwareId', toField: 'softwareId', labelField: 'softwareName' } },
    { key: 'roleCode', label: 'Code' },
    { key: 'roleName', label: 'Name' },
    { key: 'isActive', label: 'Active' },
  ],
  buildDeleteRequest: (row) => ({ roleId: row['roleId'] }),
  buildListRequest: (searchText, extraFilterValues) => ({
    searchText: searchText || null,
    isActive: null,
    softwareId: extraFilterValues?.['softwareId'] || null,
  }),
  buildHistoryRequest: (row) => ({ roleId: row['roleId'] }),
};
