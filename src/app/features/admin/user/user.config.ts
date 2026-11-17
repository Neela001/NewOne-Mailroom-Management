import { MasterEntityConfig } from '../../master/shared/master-entity-config.model';
import { USER_TYPE_OPTIONS } from './user.model';

// Fields from the live spec's UserRequest/UserGetRequest/UserHistoryGetRequest,
// confirmed against a real authenticated admin/user/get + admin/user/history/get
// response. NOT routed as a masterRoute() — see user-list.component.ts's own
// comment for why User Master is a dedicated feature (3-tab Add/Edit with a
// combined User+Roles+Desks save, Unlock User, Reset Password). Kept and
// reused ONLY to drive the "View History" action via the existing
// MasterViewHistoryDialogComponent, the same pattern already established
// for Role Rights. roleId/roleName are deliberately NOT listed here — the
// real system assigns MULTIPLE roles per user via admin/user/save-with-
// roles' own roleIds array (CONFIRMED — UserWithRolesRequest has no single
// roleId field at all), not a single roleId on the user record itself.
export const USER_CONFIG: MasterEntityConfig = {
  entityLabel: 'User',
  entityLabelPlural: 'Users',
  apiBasePath: 'admin/user',
  idField: 'userId',
  columns: [
    { key: 'userName', label: 'Username' },
    { key: 'userType', label: 'Type' },
    { key: 'personName', label: 'Linked Person' },
  ],
  formFields: [
    { key: 'userType', label: 'User Type', type: 'select', options: USER_TYPE_OPTIONS },
    { key: 'personName', label: 'Linked Person', type: 'text' },
    { key: 'userName', label: 'Username', type: 'text', required: true },
    { key: 'forcePasswordChange', label: 'Password Change Required', type: 'boolean' },
    { key: 'isLocked', label: 'Locked', type: 'boolean' },
    { key: 'failedLoginCount', label: 'Failed Login Attempts', type: 'text' },
    { key: 'lastLoginDate', label: 'Last Login', type: 'text' },
  ],
  historyColumns: [
    { key: 'actionDate', label: 'Action Date' },
    { key: 'actionType', label: 'Action Type' },
    { key: 'actionBy', label: 'Action By' },
    { key: 'userName', label: 'Username' },
    { key: 'userType', label: 'Type' },
    { key: 'forcePasswordChange', label: 'Password Change Required', boolean: true },
    { key: 'isLocked', label: 'Locked', boolean: true },
    { key: 'failedLoginCount', label: 'Failed Attempts' },
    { key: 'isActive', label: 'Active' },
  ],
  buildDeleteRequest: (row) => ({ userId: row['userId'] }),
  buildListRequest: (searchText) => ({ searchText: searchText || null, isActive: null }),
  buildHistoryRequest: (row) => ({ userId: row['userId'] }),
};
