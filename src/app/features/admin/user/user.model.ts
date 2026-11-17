// Fields from the live spec's UserRequest/UserWithRolesRequest + a real
// authenticated admin/user/get response (confirmed PascalCase at runtime,
// normalized to camelCase by MasterApiService.get() — see
// pascal-case.util.ts's own comment). personName is a real, already-
// resolved field the backend itself returns (whichever of employeeName/
// vendorStaffName applies) — not computed client-side.
export interface UserRow {
  userId: string;
  userType: string; // real values CONFIRMED live: 'EMPLOYEE'. 'VENDORSTAFF' is INFERRED (no live vendor-staff-typed user existed to confirm the exact casing) — see this session's own investigation report.
  employeeId: string | null;
  vendorStaffId: string | null;
  userName: string;
  isFirstLogin: boolean;
  firstLoginDate: string | null;
  passwordChangedDate: string | null;
  forcePasswordChange: boolean;
  lastLoginDate: string | null;
  failedLoginCount: number;
  isLocked: boolean;
  lockedDate: string | null;
  isActive: boolean;
  employeeName: string | null;
  vendorStaffName: string | null;
  personName: string | null;
}

export const USER_TYPE_OPTIONS = [
  { label: 'Employee', value: 'EMPLOYEE' },
  { label: 'Vendor Staff', value: 'VENDORSTAFF' },
];

export function userTypeLabel(userType: string | null | undefined): string {
  return USER_TYPE_OPTIONS.find((o) => o.value === userType)?.label ?? (userType || '—');
}

// Fields from the live spec's UserroleGetRequest/UserRoleHistoryResponse.
export interface UserRoleRow {
  userRoleId: string;
  userId: string;
  roleId: string;
  isActive: boolean;
  userCode: string;
  userName: string;
  roleCode: string;
  roleName: string;
}

// Fields from the live spec's DeskUserGetRequest's own real response shape
// (confirmed live — DeskAssignmentRow in desk-context.service.ts's own
// territory carries the same shape for "my own" desks; this is the same
// real entity, just for an arbitrary user rather than the current one).
export interface DeskUserRow {
  deskUserId: string;
  userId: string;
  deskId: string;
  isActive: boolean;
  isDefault: boolean;
  userName: string;
  deskCode: string;
  deskName: string;
  siteId: string;
  siteName: string;
  cityId: string;
  cityName: string;
  isAvailable: boolean;
}

// Fields from the live spec's admin/desk-user/options/get real response —
// the assignable desk catalog for Tab 3, independent of any one user.
export interface DeskOptionRow {
  deskId: string;
  deskCode: string;
  deskName: string;
  siteId: string;
  siteName: string;
  cityId: string;
  cityName: string;
  isAvailable: boolean;
}
