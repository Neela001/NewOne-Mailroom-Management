import { MasterEntityConfig } from '../../master/shared/master-entity-config.model';

// Fields from the live spec's UserroleRequest/UserroleGetRequest.
export const USERROLE_CONFIG: MasterEntityConfig = {
  entityLabel: 'User Role',
  entityLabelPlural: 'User Roles',
  apiBasePath: 'admin/userrole',
  idField: 'userRoleId',
  columns: [
    { key: 'userName', label: 'User', resolveFrom: { apiBasePath: 'admin/user', fromField: 'userId', toField: 'userId', labelField: 'userName' } },
    { key: 'roleName', label: 'Role', resolveFrom: { apiBasePath: 'admin/role', fromField: 'roleId', toField: 'roleId', labelField: 'roleName' } },
  ],
  formFields: [
    { key: 'userId', label: 'User', type: 'select', required: true, optionsSource: { apiBasePath: 'admin/user', valueField: 'userId', labelField: 'userName' } },
    { key: 'roleId', label: 'Role', type: 'select', required: true, optionsSource: { apiBasePath: 'admin/role', valueField: 'roleId', labelField: 'roleName' } },
    { key: 'remarks', label: 'Remarks', type: 'textarea', fullRow: true },
  ],
  historyColumns: [
    { key: 'actionDate', label: 'Action Date' },
    { key: 'actionType', label: 'Action Type' },
    { key: 'actionBy', label: 'Action By' },
    { key: 'userName', label: 'User', resolveFrom: { apiBasePath: 'admin/user', fromField: 'userId', toField: 'userId', labelField: 'userName' } },
    { key: 'roleName', label: 'Role', resolveFrom: { apiBasePath: 'admin/role', fromField: 'roleId', toField: 'roleId', labelField: 'roleName' } },
    { key: 'isActive', label: 'Active' },
  ],
  buildDeleteRequest: (row) => ({ userRoleId: row['userRoleId'] }),
  buildListRequest: (searchText) => ({ searchText: searchText || null, isActive: null }),
  buildHistoryRequest: (row) => ({ userRoleId: row['userRoleId'] }),
};
