import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { COMPANYGROUP_CONFIG } from './features/master/companygroup/companygroup.config';
import { AREA_CONFIG } from './features/master/area/area.config';
import { COMPANY_CONFIG } from './features/master/company/company.config';
import { DIVISION_CONFIG } from './features/master/division/division.config';
import { DEPARTMENT_CONFIG } from './features/master/department/department.config';
import { COSTCENTER_CONFIG } from './features/master/costcenter/costcenter.config';
import { DESIGNATION_CONFIG } from './features/master/designation/designation.config';
import { BRANCH_CONFIG } from './features/master/branch/branch.config';
import { SITE_CONFIG } from './features/master/site/site.config';
import { BUILDING_CONFIG } from './features/master/building/building.config';
import { FLOOR_CONFIG } from './features/master/floor/floor.config';
import { WING_CONFIG } from './features/master/wing/wing.config';
import { FLAT_CONFIG } from './features/master/flat/flat.config';
import { BRANCHLOCATION_CONFIG } from './features/master/branchlocation/branchlocation.config';
import { EMPLOYEE_CONFIG } from './features/master/employee/employee.config';
import { EMPLOYEELOCATION_CONFIG } from './features/master/employeelocation/employeelocation.config';
import { EMPLOYEESECRETARY_CONFIG } from './features/master/employeesecretary/employeesecretary.config';
import { VENDOR_CONFIG } from './features/master/vendor/vendor.config';
import { VENDORSTAFF_CONFIG } from './features/master/vendorstaff/vendorstaff.config';
import { VENDORSTAFFLOCATION_CONFIG } from './features/master/vendorstafflocation/vendorstafflocation.config';
import { SOFTWARE_CONFIG } from './features/admin/software/software.config';
import { MAINMENU_CONFIG } from './features/admin/mainmenu/mainmenu.config';
import { VERTICALMENU_CONFIG } from './features/admin/verticalmenu/verticalmenu.config';
import { SUBMENU_CONFIG } from './features/admin/submenu/submenu.config';
import { ROLE_CONFIG } from './features/admin/role/role.config';
import { USERROLE_CONFIG } from './features/admin/userrole/userrole.config';
import { ROOM_CONFIG } from './features/master/room/room.config';
import { COURIERMODE_CONFIG } from './features/mailroom/couriermode/couriermode.config';
import { COURIERPRODUCTGROUP_CONFIG } from './features/mailroom/courierproductgroup/courierproductgroup.config';
import { COURIERPRODUCT_CONFIG } from './features/mailroom/courierproduct/courierproduct.config';
import { COURIERVENDOR_CONFIG } from './features/mailroom/couriervendor/couriervendor.config';

// Every `master/*` / `admin/*` route below loads the SAME generic
// MasterListComponent, just with a different entity config passed via
// route `data` — see master-entity-config.model.ts's own comment for why.
// Route path === the entity's own real apiBasePath (e.g. 'master/company'),
// matching the convention already confirmed for Country in Phase 1 and
// intended to match the real `menuUrl` values the backend's own SubMenu
// rows carry (confirmed once a real authenticated response exists — see
// the Phase 2 report's own verification note).
const masterRoute = (path: string, config: unknown) => ({
  path,
  loadComponent: () => import('./features/master/shared/master-list.component').then((m) => m.MasterListComponent),
  data: { config },
});

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'otp-login',
    loadComponent: () => import('./features/auth/otp-login/otp-login.component').then((m) => m.OtpLoginComponent),
  },
  {
    path: 'app',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/shell/shell.component').then((m) => m.ShellComponent),
    children: [
      { path: '', loadComponent: () => import('./features/home/home.component').then((m) => m.HomeComponent) },

      {
        // Dedicated — not masterRoute() — see country-list.component.ts's
        // own comment for why: the real Windows reference's own Add/Edit
        // popup layout (Country Code/Country Name sharing one row at
        // uneven widths, an "Available Levels" group of 4 checkboxes
        // positioned inline rather than in a separate bottom checkbox
        // grid, a bordered panel, a custom subtitle/footer) has no shape
        // in the generic formFields model and wasn't worth bolting onto
        // the 23-other-entity-shared MasterFormDialogComponent.
        // COUNTRY_CONFIG still exists and is reused inside this component
        // for its own "View / History" action only.
        path: 'master/country',
        loadComponent: () => import('./features/master/country/country-list.component').then((m) => m.CountryListComponent),
      },
      {
        // Dedicated — not masterRoute() — see
        // companygroup-list.component.ts's own comment for why: not a
        // cascading-dropdown mismatch like every other location Master
        // this session, but a real mismatch in the generic dialog's own
        // fixed header/footer chrome (no subtitle, no footer helper text,
        // hardcoded "Close"/"Save" button labels) versus this task's own
        // explicit copy requirements (an exact subtitle, a footer helper
        // line, "Cancel"/"Save Company Group" button labels, and an
        // Edit-mode-specific "Update Company Group" label).
        // COMPANYGROUP_CONFIG still exists and is reused inside this
        // component for its own "View / History" action only.
        path: 'master/companygroup',
        loadComponent: () => import('./features/master/companygroup/companygroup-list.component').then((m) => m.CompanyGroupListComponent),
      },
      {
        // Dedicated — not masterRoute() — see state-list.component.ts's
        // own comment for why: the real Windows reference's own Add/Edit
        // popup Country dropdown (filtered to active, State-enabled
        // countries only, combined "Name (Code)" labels) has no shape in
        // the generic optionsSource model, and the list page's own
        // single-row toolbar doesn't match MasterListComponent's own
        // layout either — same reasoning as Country Master's own rebuild
        // this session. STATE_CONFIG still exists and is reused inside
        // this component for its own "View / History" action only.
        path: 'master/state',
        loadComponent: () => import('./features/master/state/state-list.component').then((m) => m.StateListComponent),
      },
      {
        // Dedicated — not masterRoute() — see city-list.component.ts's
        // own comment for why: the real Windows reference's own Add/Edit
        // popup Country -> State dependency logic (a State dropdown
        // client-side filtered to the selected Country, disabled and
        // relabeled "State (Not applicable)" when that Country has no
        // State support) has no shape in the generic optionsSource model,
        // and the list page's own single-row toolbar doesn't match
        // MasterListComponent's own layout either — same reasoning as
        // Country/State Master's own rebuilds this session. CITY_CONFIG
        // still exists and is reused inside this component for its own
        // "View / History" action only.
        path: 'master/city',
        loadComponent: () => import('./features/master/city/city-list.component').then((m) => m.CityListComponent),
      },
      {
        // Dedicated — not masterRoute() — see postalcode-list.component.ts's
        // own comment for why: the real Windows reference's own Add/Edit
        // popup Country -> State -> City dependency logic (both State and
        // City optional, each independently cascading, client-side
        // filtered — CONFIRMED LIVE neither StateGetRequest nor
        // CityGetRequest has a countryId/stateId filter param) has no
        // shape in the generic optionsSource model, and the list page's
        // own single-row toolbar doesn't match MasterListComponent's own
        // layout either — same reasoning as Country/State/City Master's
        // own rebuilds this session. POSTALCODE_CONFIG still exists and
        // is reused inside this component for its own "View / History"
        // action only.
        path: 'master/postalcode',
        loadComponent: () => import('./features/master/postalcode/postalcode-list.component').then((m) => m.PostalCodeListComponent),
      },
      {
        // Dedicated — not masterRoute() — see area-list.component.ts's own
        // comment for why: the real Windows reference's own Add/Edit popup
        // Country -> State -> City -> Postal Code dependency logic (a
        // 4-level chain, each dependent level independently gated and
        // dynamically relabeled "(not applicable)" by its own real country
        // capability flag, client-side filtered — CONFIRMED LIVE none of
        // StateGetRequest/CityGetRequest/PostalcodeGetRequest has a parent
        // filter param) has no shape in the generic optionsSource model,
        // and the list page's own single-row toolbar doesn't match
        // MasterListComponent's own layout either — same reasoning as
        // Country/State/City/Postal Code Master's own rebuilds this
        // session. AREA_CONFIG still exists and is reused inside this
        // component for its own "View / History" action only.
        path: 'master/area',
        loadComponent: () => import('./features/master/area/area-list.component').then((m) => m.AreaListComponent),
      },
      {
        // Dedicated — not masterRoute() — see company-list.component.ts's
        // own comment for why: not a cascading-dropdown mismatch (Company
        // Master has only one single-level dropdown dependency) but a
        // real mismatch in the generic dialog's own fixed header/footer
        // chrome plus this task's own explicit dark navy popup header
        // requirement, which the generic dialog has no shape for at all.
        // COMPANY_CONFIG still exists and is reused inside this component
        // for its own "View / History" action only.
        path: 'master/company',
        loadComponent: () => import('./features/master/company/company-list.component').then((m) => m.CompanyListComponent),
      },
      {
        // Dedicated — not masterRoute() — see division-list.component.ts's
        // own comment for why: not a cascading-dropdown mismatch (Division
        // has only one single-level Company dependency) but the same
        // generic-dialog-chrome mismatch (no subtitle, no footer helper
        // text, hardcoded "Close"/"Save" labels) as Company Group/Company
        // Master's own rebuilds this session. DIVISION_CONFIG still exists
        // and is reused inside this component for its own "View / History"
        // action only.
        path: 'master/division',
        loadComponent: () => import('./features/master/division/division-list.component').then((m) => m.DivisionListComponent),
      },
      {
        // Dedicated — not masterRoute() — see
        // department-list.component.ts's own comment for why: a Company
        // -> Division dependency (Division disabled until Company is
        // selected, client-side filtered to that Company) plus the same
        // generic-dialog-chrome mismatch as Company Group/Company/
        // Division Master's own rebuilds this session. DEPARTMENT_CONFIG
        // still exists and is reused inside this component for its own
        // "View / History" action only.
        path: 'master/department',
        loadComponent: () => import('./features/master/department/department-list.component').then((m) => m.DepartmentListComponent),
      },
      {
        // Dedicated — not masterRoute() — see
        // costcenter-list.component.ts's own comment for why: not a
        // cascading-dropdown mismatch (Cost Center has only one
        // single-level Company dependency) but the same generic-dialog-
        // chrome mismatch as Company Group/Division/Department Master's
        // own rebuilds this session. COSTCENTER_CONFIG still exists and
        // is reused inside this component for its own "View / History"
        // action only.
        path: 'master/costcenter',
        loadComponent: () => import('./features/master/costcenter/costcenter-list.component').then((m) => m.CostCenterListComponent),
      },
      {
        // Dedicated — not masterRoute() — see
        // designation-list.component.ts's own comment for why: the same
        // generic-dialog-chrome mismatch as Cost Center/Division/
        // Department Master's own rebuilds this session (single-level
        // Company dependency, not a cascading one), PLUS a "Specify
        // level" checkbox the generic field-rendering loop has no
        // concept of. DESIGNATION_CONFIG still exists and is reused
        // inside this component for its own "View / History" action
        // only.
        path: 'master/designation',
        loadComponent: () => import('./features/master/designation/designation-list.component').then((m) => m.DesignationListComponent),
      },
      {
        // Dedicated — not masterRoute() — see branch-list.component.ts's
        // own comment for why: the real Windows reference's own Add
        // Branch popup (a Company -> Country -> City -> Site 4-level
        // dependency, read-only State/Postal Code/Area fields derived
        // from the selected Site, and a full "Branch Location Selection"
        // grid of checkable Building/Floor/Wing combinations submitted
        // together with the rest of the Branch via one real combined
        // API call) has no shape in the generic formFields model
        // whatsoever — see branch-form-dialog.component.ts's own
        // comment for the full confirmed-live API writeup. BRANCH_CONFIG
        // still exists and is reused inside this component for its own
        // "View / History" action only.
        path: 'master/branch',
        loadComponent: () => import('./features/master/branch/branch-list.component').then((m) => m.BranchListComponent),
      },
      {
        // Dedicated — not masterRoute() — see site-list.component.ts's own
        // comment for why: the real Windows reference's own Add/Edit popup
        // Country -> State -> City -> Postal Code -> Area dependency logic
        // (a 5-level chain, each dependent level independently gated and
        // dynamically relabeled "(not applicable)" by its own real country
        // capability flag, client-side filtered — CONFIRMED LIVE none of
        // StateGetRequest/CityGetRequest/PostalcodeGetRequest/
        // AreaGetRequest has a parent filter param) has no shape in the
        // generic optionsSource model, and the list page's own single-row
        // toolbar doesn't match MasterListComponent's own layout either —
        // same reasoning as Country/State/City/Postal Code/Area Master's
        // own rebuilds this session. SITE_CONFIG still exists and is
        // reused inside this component for its own "View / History"
        // action only.
        path: 'master/site',
        loadComponent: () => import('./features/master/site/site-list.component').then((m) => m.SiteListComponent),
      },
      {
        // Dedicated — not masterRoute() — see building-list.component.ts's
        // own comment for why: the real Windows reference's own Add/Edit
        // popup (a full-width Site searchable dropdown, Building Code/
        // Building Name sharing one row, a full-width Building Type
        // field, and an Edit-mode-specific "Update Building" submit
        // button label) has no shape in the generic formFields model, and
        // the list page's own single-row toolbar doesn't match
        // MasterListComponent's own layout either — same reasoning as
        // Country/State/City/Postal Code/Area/Site Master's own rebuilds
        // this session. BUILDING_CONFIG still exists and is reused inside
        // this component for its own "View / History" action only.
        path: 'master/building',
        loadComponent: () => import('./features/master/building/building-list.component').then((m) => m.BuildingListComponent),
      },
      {
        // Dedicated — not masterRoute() — see floor-list.component.ts's
        // own comment for why: the real Windows reference's own Add/Edit
        // popup (a Site -> Building dependency, Floor Code/Floor Name
        // sharing one row, a left-column-only optional Floor Number that
        // must preserve 0 and negative values, and an Edit-mode-specific
        // "Update Floor" submit button label) has no shape in the generic
        // formFields model, and the list page's own single-row toolbar
        // doesn't match MasterListComponent's own layout either — same
        // reasoning as Country/State/City/Postal Code/Area/Site/Building
        // Master's own rebuilds this session. FLOOR_CONFIG still exists
        // and is reused inside this component for its own "View /
        // History" action only.
        path: 'master/floor',
        loadComponent: () => import('./features/master/floor/floor-list.component').then((m) => m.FloorListComponent),
      },
      {
        // Dedicated — not masterRoute() — see wing-list.component.ts's
        // own comment for why: the real Windows reference's own Add/Edit
        // popup (a Site -> Building -> Floor 3-level dependency, a
        // single-column full-width layout, dynamic "Select X to
        // continue." footer guidance, and an Edit-mode-specific "Update
        // Wing" submit button label) has no shape in the generic
        // formFields model, and the list page's own single-row toolbar
        // doesn't match MasterListComponent's own layout either — same
        // reasoning as Country/State/City/Postal Code/Area/Site/Building/
        // Floor Master's own rebuilds this session. WING_CONFIG still
        // exists and is reused inside this component for its own "View /
        // History" action only.
        path: 'master/wing',
        loadComponent: () => import('./features/master/wing/wing-list.component').then((m) => m.WingListComponent),
      },
      {
        // Dedicated — not masterRoute() — see flat-list.component.ts's
        // own comment for why: the real Windows reference's own Add/Edit
        // popup (a Site -> Building -> Floor -> Wing 4-level dependency
        // with the Building dropdown restricted to active RESIDENTIAL
        // buildings only — a real, CONFIRMED-LIVE backend-enforced rule —
        // a 3-column Flat Code/Flat Number/Flat Name row, and an
        // Edit-mode-specific "Update Flat" submit button label) has no
        // shape in the generic formFields model, and the list page's own
        // single-row toolbar doesn't match MasterListComponent's own
        // layout either — same reasoning as Country/State/City/Postal
        // Code/Area/Site/Building/Floor/Wing Master's own rebuilds this
        // session. FLAT_CONFIG still exists and is reused inside this
        // component for its own "View / History" action only.
        path: 'master/flat',
        loadComponent: () => import('./features/master/flat/flat-list.component').then((m) => m.FlatListComponent),
      },
      masterRoute('master/branchlocation', BRANCHLOCATION_CONFIG),
      {
        // Dedicated — not masterRoute() — see employee-list.component.ts's
        // own comment for why: a genuine 3-tab workflow (Employee
        // Details, Locations, Secretaries) built on a dedicated combined-
        // assignment API family (master/employee/save-with-assignments,
        // delete-with-assignments, assignments/get, location-options/get
        // — see employee.model.ts's own confirmed-live writeup) with no
        // shape in the generic formFields model whatsoever.
        // EMPLOYEE_CONFIG still exists and is reused inside this
        // component for its own "View / History" action only.
        path: 'master/employee',
        loadComponent: () => import('./features/master/employee/employee-list.component').then((m) => m.EmployeeListComponent),
      },
      masterRoute('master/employeelocation', EMPLOYEELOCATION_CONFIG),
      masterRoute('master/employeesecretary', EMPLOYEESECRETARY_CONFIG),
      masterRoute('master/vendor', VENDOR_CONFIG),
      masterRoute('master/vendorstaff', VENDORSTAFF_CONFIG),
      masterRoute('master/vendorstafflocation', VENDORSTAFFLOCATION_CONFIG),

      masterRoute('admin/software', SOFTWARE_CONFIG),
      masterRoute('admin/mainmenu', MAINMENU_CONFIG),
      masterRoute('admin/verticalmenu', VERTICALMENU_CONFIG),
      masterRoute('admin/submenu', SUBMENU_CONFIG),
      masterRoute('admin/role', ROLE_CONFIG),
      masterRoute('admin/userrole', USERROLE_CONFIG),

      {
        // Dedicated — not masterRoute() — see room-list.component.ts's
        // own comment for why: the real Windows reference's own Add/Edit
        // popup (a Site -> Building -> Floor -> Wing required 4-level
        // chain plus an optional Flat level gated by the selected
        // Building's own real buildingType — RESIDENTIAL only, with both
        // COMMERCIAL and RESIDENTIAL buildings otherwise offered — a
        // read-only, CONFIRMED-LIVE backend-auto-generated Room Code
        // field, a 3-column Room Code/Room Number/Room Name row, dynamic
        // footer guidance, and an Edit-mode-specific "Update Room" submit
        // button label) has no shape in the generic formFields model, and
        // the list page's own single-row toolbar doesn't match
        // MasterListComponent's own layout either — same reasoning as
        // Country/State/City/Postal Code/Area/Site/Building/Floor/Wing/
        // Flat Master's own rebuilds this session. ROOM_CONFIG still
        // exists and is reused inside this component for its own "View /
        // History" action only.
        path: 'master/room',
        loadComponent: () => import('./features/master/room/room-list.component').then((m) => m.RoomListComponent),
      },

      // MAILROOM-software-only entities (Master > Service Provider) — route
      // path matches the real backend menuUrl exactly, including its own
      // inconsistent casing (confirmed via admin/submenu/get), not a
      // "corrected" lowercase path.
      {
        // Dedicated — not masterRoute() — see
        // couriermode-list.component.ts's own comment for why: the same
        // generic-dialog-chrome mismatch as Cost Center/Division/Company
        // Group Master's own rebuilds this session (no dependency at
        // all, not even a cascading one). COURIERMODE_CONFIG still
        // exists and is reused inside this component for its own
        // "View / History" action only.
        path: 'mailroom/master/CourierMode',
        loadComponent: () => import('./features/mailroom/couriermode/couriermode-list.component').then((m) => m.CourierModeListComponent),
      },
      {
        // Dedicated — not masterRoute() — see
        // courierproductgroup-list.component.ts's own comment for why:
        // the same generic-dialog-chrome mismatch as Courier Mode/Cost
        // Center/Division/Company Group Master's own rebuilds this
        // session (no dependency at all, not even a cascading one).
        // COURIERPRODUCTGROUP_CONFIG still exists and is reused inside
        // this component for its own "View / History" action only.
        path: 'mailroom/master/CourierProductGroup',
        loadComponent: () => import('./features/mailroom/courierproductgroup/courierproductgroup-list.component').then((m) => m.CourierProductGroupListComponent),
      },
      {
        // Dedicated — not masterRoute() — see
        // courierproduct-list.component.ts's own comment for why: a
        // genuine Mode -> Vendor -> Service Type dependency chain (Service
        // Type derived from the selected Vendor, not independently
        // browsable) plus a real business-rule-level Volumetric Divisor
        // validation (see courierproduct.model.ts's own confirmed-live
        // writeup), neither of which the generic formFields model
        // expresses. COURIERPRODUCT_CONFIG still exists and is reused
        // inside this component for its own "View / History" action only.
        path: 'mailroom/master/CourierProduct',
        loadComponent: () => import('./features/mailroom/courierproduct/courierproduct-list.component').then((m) => m.CourierProductListComponent),
      },
      {
        // Dedicated — not masterRoute() — see
        // couriervendor-list.component.ts's own comment for why: a
        // genuine 3-tab workflow (Vendor Details, Desks, Contacts) built
        // on a dedicated combined-save API family (master/couriervendor/
        // save-with-contacts, options/get, desk/get, contact/get — see
        // couriervendor.model.ts's own confirmed-live writeup), plus two
        // extra listing actions ("View Desks"/"View Contacts") the
        // generic list has no concept of. COURIERVENDOR_CONFIG still
        // exists and is reused inside this component for its own
        // "View / History" action only.
        path: 'mailroom/master/CourierVendor',
        loadComponent: () => import('./features/mailroom/couriervendor/couriervendor-list.component').then((m) => m.CourierVendorListComponent),
      },

      // Dedicated, non-generic features — see desk.model.ts / useraudit.model.ts
      // for why they don't go through masterRoute().
      {
        path: 'admin/desk',
        loadComponent: () => import('./features/admin/desk/desk-list.component').then((m) => m.DeskListComponent),
      },
      {
        // Dedicated — not masterRoute() — see
        // emailsetting-form-dialog.component.ts's own comment for why:
        // real server-driven Authentication/Encryption option sets
        // (master/email-setting/options/get), a Remove-saved-password
        // flow, and a Reload SMTP Options action. EMAILSETTING_CONFIG
        // still exists and is reused inside this component for its own
        // "View History" action only.
        path: 'admin/emailsetting',
        loadComponent: () => import('./features/admin/emailsetting/emailsetting-list.component').then((m) => m.EmailSettingListComponent),
      },
      {
        // Dedicated — not masterRoute() — see user-form-dialog.component.ts's
        // own comment for why: a 3-tab Add/Edit (Account/Roles/Desks) with a
        // single combined admin/user/save-with-roles transaction (real,
        // confirmed — matches AdminApiService.SaveUserWithRolesAsync in
        // D:\NewOne's own reflected types), plus Unlock User / Reset
        // Password, none of which the generic trio has a shape for.
        // USER_CONFIG still exists and is reused inside this component for
        // its own "View History" action only.
        path: 'admin/user',
        loadComponent: () => import('./features/admin/user/user-list.component').then((m) => m.UserListComponent),
      },
      {
        // Dedicated — not masterRoute() — see rolerights-list.component.ts's
        // own comment for why: the real Windows reference screen is a
        // per-role permission MATRIX (every menu always shown, batch save),
        // not a flat add/edit-one-row list. ROLERIGHTS_CONFIG still exists
        // and is reused inside this component for its own per-row "View
        // History" action only.
        path: 'admin/rolerights',
        loadComponent: () => import('./features/admin/rolerights/rolerights-list.component').then((m) => m.RoleRightsListComponent),
      },
      {
        // CONFIRMED LIVE (real backend, real account, 2026-10-16/17): the
        // real subMenu row for this screen has menuUrl "/admin/useraudit",
        // not "/admin/audit" (this entity's own apiBasePath, which this
        // route was mistakenly matched to instead) — without this fix the
        // real sidebar link for User Audit led nowhere (no route matched,
        // falling through to the wildcard redirect to /login), reproduced
        // directly via a real authenticated navigation to that URL.
        path: 'admin/useraudit',
        loadComponent: () => import('./features/admin/useraudit/useraudit-list.component').then((m) => m.UserAuditListComponent),
      },
      {
        // Dedicated — not masterRoute() — see voter-list.component.ts's
        // own comment for why: the Windows reference's own exact filter
        // set (Voter ID exact / Ward No / Booth No / a combined Name-
        // relative-house search / Status), column order, and a real
        // Import Voters workflow (Excel parsed client-side into
        // master/voter-record/import-batch rows — see voter.model.ts's
        // own comment for why there's no OCR/image/PDF extraction
        // capability on this backend) none of which the generic
        // columns/formFields model has a shape for. VOTER_CONFIG still
        // exists and is reused inside this component for its own "View /
        // History" action only.
        path: 'admin/voter',
        loadComponent: () => import('./features/admin/voter/voter-list.component').then((m) => m.VoterListComponent),
      },
      {
        // Dedicated — not masterRoute() — see uploadmaster-form-dialog.
        // component.ts's own comment for why: the real procedure-driven
        // field dependency logic (XML parameter / Context parameter /
        // Context type auto-populated and locked from admin/upload-master/
        // procedures/get) and the XML layout tab's columns editor have no
        // shape in the generic columns/formFields model. UPLOADMASTER_CONFIG
        // still exists and is reused inside this component for its own
        // "View / History" action only. This path matches menu.service.ts's
        // own MENU_URL_FALLBACK_BY_SUBMENU_CODE['UPLOADMASTER'] value, which
        // is needed because the real backend menuUrl for this subMenu is
        // null despite full rights being granted — see that file's own
        // comment.
        path: 'admin/uploadmaster',
        loadComponent: () => import('./features/admin/uploadmaster/uploadmaster-list.component').then((m) => m.UploadMasterListComponent),
      },
      {
        // Dedicated — not masterRoute() — see uploadfiles.model.ts's own
        // comment for the real admin/uploads/* endpoints this is built
        // against (job listing/submit/template/result/history — none of
        // which the generic columns/formFields model, or even Upload
        // Master's own config, has a shape for: this screen has no
        // Add/Edit/Delete at all). This path matches menu.service.ts's own
        // MENU_URL_FALLBACK_BY_SUBMENU_CODE['UPLOADFILES'] value, needed
        // for the same real-backend-menuUrl-is-null reason as Upload
        // Master's own entry above — see that file's own comment.
        path: 'admin/uploadfiles',
        loadComponent: () => import('./features/admin/uploadfiles/uploadfiles-list.component').then((m) => m.UploadFilesListComponent),
      },
    ],
  },
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  { path: '**', redirectTo: 'login' },
];
