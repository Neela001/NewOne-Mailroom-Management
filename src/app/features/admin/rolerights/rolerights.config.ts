import { MasterEntityConfig } from '../../master/shared/master-entity-config.model';

// Fields from the live spec's RoleRightsRequest/RoleRightsGetRequest — this
// is the actual admin screen for configuring the canView/canAdd/canEdit/
// canDelete permissions that MenuService reads back via
// GET admin/user-rights/me (see menu.model.ts's own comment).
//
// The Role toolbar filter also doubles as the landing spot for Role
// Master's own "Role Rights" button (see role.config.ts's own
// secondaryAction comment): its ?roleId=... query param seeds this exact
// filter's initial value (matched by key, generically, in
// master-list.component.ts's own constructor), so arriving from there
// already shows just that role's own permission rows instead of the full
// unfiltered list.
export const ROLERIGHTS_CONFIG: MasterEntityConfig = {
  entityLabel: 'Role Right',
  entityLabelPlural: 'Role Rights',
  apiBasePath: 'admin/rolerights',
  idField: 'roleRightId',
  extraFilters: [{ key: 'roleId', label: 'Role', apiBasePath: 'admin/role', valueField: 'roleId', labelField: 'roleName' }],
  columns: [
    { key: 'roleName', label: 'Role', resolveFrom: { apiBasePath: 'admin/role', fromField: 'roleId', toField: 'roleId', labelField: 'roleName' } },
    { key: 'subMenuName', label: 'Sub Menu', resolveFrom: { apiBasePath: 'admin/submenu', fromField: 'subMenuId', toField: 'subMenuId', labelField: 'subMenuName' } },
    { key: 'canView', label: 'View' },
    { key: 'canAdd', label: 'Add' },
    { key: 'canEdit', label: 'Edit' },
    { key: 'canDelete', label: 'Delete' },
  ],
  formFields: [
    { key: 'roleId', label: 'Role', type: 'select', required: true, optionsSource: { apiBasePath: 'admin/role', valueField: 'roleId', labelField: 'roleName' } },
    { key: 'subMenuId', label: 'Sub Menu', type: 'select', required: true, optionsSource: { apiBasePath: 'admin/submenu', valueField: 'subMenuId', labelField: 'subMenuName' } },
    { key: 'canView', label: 'Can View', type: 'boolean' },
    { key: 'canAdd', label: 'Can Add', type: 'boolean' },
    { key: 'canEdit', label: 'Can Edit', type: 'boolean' },
    { key: 'canDelete', label: 'Can Delete', type: 'boolean' },
    { key: 'remarks', label: 'Remarks', type: 'textarea', fullRow: true },
  ],
  historyColumns: [
    { key: 'actionDate', label: 'Action Date' },
    { key: 'actionType', label: 'Action Type' },
    { key: 'actionBy', label: 'Action By' },
    { key: 'roleName', label: 'Role', resolveFrom: { apiBasePath: 'admin/role', fromField: 'roleId', toField: 'roleId', labelField: 'roleName' } },
    { key: 'subMenuName', label: 'Sub Menu', resolveFrom: { apiBasePath: 'admin/submenu', fromField: 'subMenuId', toField: 'subMenuId', labelField: 'subMenuName' } },
    { key: 'canView', label: 'View' },
    { key: 'canAdd', label: 'Add' },
    { key: 'canEdit', label: 'Edit' },
    { key: 'canDelete', label: 'Delete' },
  ],
  buildDeleteRequest: (row) => ({ roleRightId: row['roleRightId'] }),
  buildListRequest: (searchText, extraFilterValues) => ({
    searchText: searchText || null,
    isActive: null,
    roleId: extraFilterValues?.['roleId'] || null,
  }),
  buildHistoryRequest: (row) => ({ roleRightId: row['roleRightId'] }),
};
