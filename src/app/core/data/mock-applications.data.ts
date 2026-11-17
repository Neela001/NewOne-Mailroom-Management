import { Application } from '../models/application.model';

// TEMPORARY STATIC DATA — the real Software/application-catalog API isn't
// built yet (see application-launcher.service.ts's own comment for the
// swap-over point). None of these are fabricated real screens: `url` is
// set ONLY for the two entries that are genuinely real, already-implemented
// routes in this app (Mailroom's own Home, and Administration's own Main
// Menu Master); every other entry has no `url` at all, so
// AppLauncherComponent's own click handler falls through to its honest
// "Application preview only" notice instead of pretending a route exists.
export const MOCK_APPLICATIONS: Application[] = [
  { id: 'mailroom', name: 'Mailroom', icon: 'mail_outline', url: '/app', isActive: true },
  { id: 'dashboard', name: 'Dashboard', icon: 'dashboard', isActive: true },
  { id: 'hrms', name: 'HRMS', icon: 'group', isActive: true },
  { id: 'asset-management', name: 'Asset Management', icon: 'inventory_2', isActive: true },
  { id: 'visitor-management', name: 'Visitor Management', icon: 'door_open', isActive: true },
  { id: 'reports', name: 'Reports', icon: 'description', isActive: true },
  { id: 'administration', name: 'Administration', icon: 'admin_panel_settings', url: '/app/admin/mainmenu', isActive: true },
  { id: 'other', name: 'Other Applications', icon: 'folder_open', isActive: true },
];
