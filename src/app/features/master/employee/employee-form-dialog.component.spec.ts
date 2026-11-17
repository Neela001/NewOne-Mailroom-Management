import { TestBed } from '@angular/core/testing';
import { DIALOG_DATA } from '../../../shared/ui/dialog/dialog-data.token';
import { DialogRef } from '../../../shared/ui/dialog/dialog-ref';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { FormGroup } from '@angular/forms';
import { EmployeeFormDialogComponent, EmployeeFormDialogData } from './employee-form-dialog.component';
import { ConfigService } from '../../../core/services/config.service';
import { EmployeeLocationAssignmentDisplay, EmployeeLocationOptionRow, EmployeeRow, EmployeeSecretaryAssignmentDisplay } from './employee.model';
import { SelectOption } from '../../../shared/ui/form/select.component';
import { provideAppIcons } from '../../../shared/ui/icon/lucide-icons.provider';

type TestableEmployeeFormDialog = EmployeeFormDialogComponent & {
  form: FormGroup;
  companyOptions: () => SelectOption[];
  branchOptions: () => SelectOption[];
  divisionOptions: () => SelectOption[];
  departmentOptions: () => SelectOption[];
  costCenterOptions: () => SelectOption[];
  designationOptions: () => SelectOption[];
  reportingManagerOptions: () => SelectOption[];
  siteOptions: () => SelectOption[];
  secretaryCandidateOptions: () => SelectOption[];
  availableWorkstationRows: () => EmployeeLocationOptionRow[];
  locations: () => EmployeeLocationAssignmentDisplay[];
  secretaries: () => EmployeeSecretaryAssignmentDisplay[];
  secretaryFlag: () => boolean;
  errorMessage: () => string | null;
  selectedSiteId: () => string;
  selectedAvailableKey: () => string | null;
  selectedAssignedKey: () => string | null;
  onSiteChange: (siteId: string) => void;
  selectAvailableRow: (row: EmployeeLocationOptionRow) => void;
  addWorkstation: (row?: EmployeeLocationOptionRow) => void;
  selectAssignedRow: (row: EmployeeLocationAssignmentDisplay) => void;
  removeWorkstation: () => void;
  onSecretarySearchSelect: (employeeId: string) => void;
  selectSecretaryRow: (row: EmployeeSecretaryAssignmentDisplay) => void;
  removeSecretary: () => void;
  onSubmit: () => void;
};

const COMPANY_ROWS = [
  { CompanyId: 'co-1', CompanyCode: 'DEMO-COMP', CompanyName: 'Demo Technologies Pvt Ltd', IsActive: true },
  { CompanyId: 'co-2', CompanyCode: 'OTHER-CO', CompanyName: 'Other Company', IsActive: true },
];
const BRANCH_ROWS = [
  { BranchId: 'br-1', CompanyId: 'co-1', BranchCode: 'CHN-HO', BranchName: 'Chennai Head Office', IsActive: true },
  { BranchId: 'br-2', CompanyId: 'co-2', BranchCode: 'BLR-HO', BranchName: 'Bangalore Head Office', IsActive: true },
];
const DIVISION_ROWS = [{ DivisionId: 'div-1', CompanyId: 'co-1', DivisionCode: 'TECH', DivisionName: 'Technology', IsActive: true }];
const DEPARTMENT_ROWS = [{ DepartmentId: 'dept-1', CompanyId: 'co-1', DepartmentCode: 'DEV', DepartmentName: 'Development', IsActive: true }];
const COSTCENTER_ROWS = [{ CostCenterId: 'cc-1', CompanyId: 'co-1', CostCenterCode: 'CC-01', CostCenterName: 'Tech Cost Center', IsActive: true }];
const DESIGNATION_ROWS = [{ DesignationId: 'des-1', CompanyId: 'co-1', DesignationCode: 'DEV-MGR', DesignationName: 'Development Manager', IsActive: true }];
const EMPLOYEE_ROWS = [
  { EmployeeId: 'emp-mgr', CompanyId: 'co-1', EmployeeCode: 'EMP0001', FullName: 'Demo Manager', IsActive: true },
  { EmployeeId: 'emp-other-co', CompanyId: 'co-2', EmployeeCode: 'EMP0099', FullName: 'Other Co Employee', IsActive: true },
];
// Site is deliberately NOT company-scoped — CONFIRMED LIVE SiteRow has no
// companyId field at all (see employee.model.ts's own comment).
const SITE_ROWS = [{ SiteId: 'site-1', SiteCode: 'CHN01', SiteName: 'Chennai Corporate Site', IsActive: true }];
const LOCATION_OPTIONS_ROWS = [
  { SiteId: 'site-1', SiteCode: 'CHN01', SiteName: 'Chennai Corporate Site', BuildingId: 'bld-a', BuildingName: 'Corporate Tower A', FloorId: 'flr-01', FloorName: 'First Floor', WingId: 'wng-a', WingName: 'Wing A', IsAvailable: true },
  { SiteId: 'site-1', SiteCode: 'CHN01', SiteName: 'Chennai Corporate Site', BuildingId: 'bld-a', BuildingName: 'Corporate Tower A', FloorId: 'flr-02', FloorName: 'Second Floor', WingId: 'wng-b', WingName: 'Wing B', IsAvailable: true },
];

describe('EmployeeFormDialogComponent', () => {
  let httpMock: HttpTestingController;
  let dialogRefCloseSpy: ReturnType<typeof vi.fn>;

  function apiUrl(path: string): string {
    return `${TestBed.inject(ConfigService).getApiUrl()}${path}`;
  }

  function createComponent(data: EmployeeFormDialogData) {
    dialogRefCloseSpy = vi.fn();
    TestBed.configureTestingModule({
      imports: [NoopAnimationsModule],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideAppIcons(),
        { provide: DIALOG_DATA, useValue: data },
        { provide: DialogRef, useValue: { close: dialogRefCloseSpy } },
      ],
    });
    httpMock = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(EmployeeFormDialogComponent);
    fixture.detectChanges();
    return fixture;
  }

  function flushMasterData() {
    httpMock.expectOne(apiUrl('master/company/get')).flush({ success: true, data: COMPANY_ROWS });
    httpMock.expectOne(apiUrl('master/branch/get')).flush({ success: true, data: BRANCH_ROWS });
    httpMock.expectOne(apiUrl('master/division/get')).flush({ success: true, data: DIVISION_ROWS });
    httpMock.expectOne(apiUrl('master/department/get')).flush({ success: true, data: DEPARTMENT_ROWS });
    httpMock.expectOne(apiUrl('master/costcenter/get')).flush({ success: true, data: COSTCENTER_ROWS });
    httpMock.expectOne(apiUrl('master/designation/get')).flush({ success: true, data: DESIGNATION_ROWS });
    httpMock.expectOne(apiUrl('master/employee/get')).flush({ success: true, data: EMPLOYEE_ROWS });
    httpMock.expectOne(apiUrl('master/site/get')).flush({ success: true, data: SITE_ROWS });
  }

  afterEach(() => httpMock.verify());

  it('filters Branch/Division/Department/CostCenter/Designation/Reporting Manager by the selected Company, but NOT Site', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    flushMasterData();
    const component = fixture.componentInstance as TestableEmployeeFormDialog;

    expect(component.siteOptions().map((o) => o.value)).toEqual(['site-1']);

    component.form.get('companyId')!.setValue('co-1');
    expect(component.branchOptions().map((o) => o.value)).toEqual(['br-1']);
    expect(component.divisionOptions().map((o) => o.value)).toEqual(['div-1']);
    expect(component.departmentOptions().map((o) => o.value)).toEqual(['dept-1']);
    expect(component.costCenterOptions().map((o) => o.value)).toEqual(['cc-1']);
    expect(component.designationOptions().map((o) => o.value)).toEqual(['des-1']);
    expect(component.reportingManagerOptions().map((o) => o.value)).toEqual(['emp-mgr']);
    // Site options unchanged by Company.
    expect(component.siteOptions().map((o) => o.value)).toEqual(['site-1']);
  });

  it('clears dependent selections when Company changes', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    flushMasterData();
    const component = fixture.componentInstance as TestableEmployeeFormDialog;

    component.form.get('companyId')!.setValue('co-1');
    component.form.patchValue({ branchId: 'br-1', divisionId: 'div-1', departmentId: 'dept-1', costCenterId: 'cc-1', designationId: 'des-1', reportingManagerId: 'emp-mgr' });

    component.form.get('companyId')!.setValue('co-2');
    expect(component.form.get('branchId')?.value).toBe('');
    expect(component.form.get('divisionId')?.value).toBe('');
    expect(component.form.get('departmentId')?.value).toBe('');
    expect(component.form.get('costCenterId')?.value).toBe('');
    expect(component.form.get('designationId')?.value).toBe('');
    expect(component.form.get('reportingManagerId')?.value).toBe('');
  });

  it('does not submit when Company/Employee Code/Full Name are empty', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    flushMasterData();
    const component = fixture.componentInstance as TestableEmployeeFormDialog;

    component.onSubmit();

    expect(dialogRefCloseSpy).not.toHaveBeenCalled();
    httpMock.expectNone(apiUrl('master/employee/save-with-assignments'));
  });

  it('secretaryFlag is derived from the Secretaries tab, never a direct checkbox', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    flushMasterData();
    const component = fixture.componentInstance as TestableEmployeeFormDialog;

    expect(component.secretaryFlag()).toBe(false);
    component.onSecretarySearchSelect('emp-mgr');
    expect(component.secretaryFlag()).toBe(true);
    component.selectSecretaryRow(component.secretaries()[0]);
    component.removeSecretary();
    expect(component.secretaryFlag()).toBe(false);
  });

  it('prevents assigning the employee as their own secretary, and prevents duplicate secretary assignments', () => {
    const existingRow: EmployeeRow = { employeeId: 'emp-mgr', companyId: 'co-1', employeeCode: 'EMP0001', fullName: 'Demo Manager', isActive: true };
    const fixture = createComponent({ row: existingRow, mode: 'edit' });
    flushMasterData();
    httpMock.expectOne(apiUrl('master/employee/assignments/get')).flush({ success: true, data: { locations: [], secretaries: [] } });
    const component = fixture.componentInstance as TestableEmployeeFormDialog;

    // Self-secretary: emp-mgr is itself the open employee.
    component.onSecretarySearchSelect('emp-mgr');
    expect(component.secretaries().length).toBe(0);

    // emp-other-co is a real candidate (cross-company is allowed since
    // Secretary eligibility is not Company-scoped in the real schema).
    component.onSecretarySearchSelect('emp-other-co');
    expect(component.secretaries().length).toBe(1);
    component.onSecretarySearchSelect('emp-other-co');
    expect(component.secretaries().length).toBe(1);
  });

  it('excludes the currently-edited employee from their own Reporting Manager options', () => {
    const existingRow: EmployeeRow = { employeeId: 'emp-mgr', companyId: 'co-1', employeeCode: 'EMP0001', fullName: 'Demo Manager', isActive: true };
    const fixture = createComponent({ row: existingRow, mode: 'edit' });
    flushMasterData();
    httpMock.expectOne(apiUrl('master/employee/assignments/get')).flush({ success: true, data: { locations: [], secretaries: [] } });
    const component = fixture.componentInstance as TestableEmployeeFormDialog;

    expect(component.reportingManagerOptions().map((o) => o.value)).not.toContain('emp-mgr');
  });

  it('loads Available Workstations for the selected Site, and Add moves the selected row into Assigned Workstations without duplicating it', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    flushMasterData();
    const component = fixture.componentInstance as TestableEmployeeFormDialog;

    component.onSiteChange('site-1');
    httpMock.expectOne(apiUrl('master/employee/location-options/get')).flush({ success: true, data: LOCATION_OPTIONS_ROWS });

    expect(component.availableWorkstationRows().length).toBe(2);
    const [rowA] = component.availableWorkstationRows();
    component.selectAvailableRow(rowA);
    component.addWorkstation();

    expect(component.locations().length).toBe(1);
    expect(component.availableWorkstationRows().length).toBe(1); // no longer offered once assigned

    // Re-adding the same row (double-click path) must not duplicate.
    component.addWorkstation(rowA);
    expect(component.locations().length).toBe(1);
  });

  it('removes a selected Assigned Workstation row', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    flushMasterData();
    const component = fixture.componentInstance as TestableEmployeeFormDialog;

    component.onSiteChange('site-1');
    httpMock.expectOne(apiUrl('master/employee/location-options/get')).flush({ success: true, data: LOCATION_OPTIONS_ROWS });
    component.addWorkstation(component.availableWorkstationRows()[0]);
    expect(component.locations().length).toBe(1);

    component.selectAssignedRow(component.locations()[0]);
    component.removeWorkstation();
    expect(component.locations().length).toBe(0);
  });

  it('restores existing Locations and Secretaries on Edit, filtering out inactive assignment rows', () => {
    const existingRow: EmployeeRow = { employeeId: 'emp-1', companyId: 'co-1', employeeCode: 'EMP0002', fullName: 'Demo Employee', isActive: true };
    const fixture = createComponent({ row: existingRow, mode: 'edit' });
    flushMasterData();
    const req = httpMock.expectOne(apiUrl('master/employee/assignments/get'));
    expect(req.request.body).toEqual({ employeeId: 'emp-1' });
    req.flush({
      success: true,
      data: {
        locations: [
          { EmployeeLocationId: 'el-1', SiteId: 'site-1', BuildingId: 'bld-a', FloorId: 'flr-01', WingId: 'wng-a', IsActive: true, SiteName: 'Chennai Corporate Site', BuildingName: 'Corporate Tower A', FloorName: 'First Floor', WingName: 'Wing A' },
          { EmployeeLocationId: 'el-2', SiteId: 'site-1', BuildingId: 'bld-a', FloorId: 'flr-02', WingId: 'wng-b', IsActive: false, SiteName: 'Chennai Corporate Site', BuildingName: 'Corporate Tower A', FloorName: 'Second Floor', WingName: 'Wing B' },
        ],
        secretaries: [
          { EmployeeSecretaryId: 'es-1', SecretaryEmployeeId: 'emp-mgr', IsActive: true, SecretaryEmployeeCode: 'EMP0001', SecretaryEmployeeName: 'Demo Manager' },
          { EmployeeSecretaryId: 'es-2', SecretaryEmployeeId: 'emp-other-co', IsActive: false, SecretaryEmployeeCode: 'EMP0099', SecretaryEmployeeName: 'Other Co Employee' },
        ],
      },
    });
    const component = fixture.componentInstance as TestableEmployeeFormDialog;

    expect(component.locations().map((l) => l.wingId)).toEqual(['wng-a']);
    expect(component.secretaries().map((s) => s.secretaryEmployeeId)).toEqual(['emp-mgr']);
    expect(component.secretaryFlag()).toBe(true);
  });

  it('submits the full locations/secretaries arrays and the derived secretaryFlag to save-with-assignments', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    flushMasterData();
    const component = fixture.componentInstance as TestableEmployeeFormDialog;

    component.form.patchValue({ companyId: 'co-1', employeeCode: 'EMP0100', fullName: 'New Employee' });
    component.onSiteChange('site-1');
    httpMock.expectOne(apiUrl('master/employee/location-options/get')).flush({ success: true, data: LOCATION_OPTIONS_ROWS });
    component.addWorkstation(component.availableWorkstationRows()[0]);
    component.onSecretarySearchSelect('emp-mgr');

    component.onSubmit();

    const req = httpMock.expectOne(apiUrl('master/employee/save-with-assignments'));
    expect(req.request.body.employeeId).toBeNull();
    expect(req.request.body.companyId).toBe('co-1');
    expect(req.request.body.secretaryFlag).toBe(true);
    expect(req.request.body.locations).toEqual([{ siteId: 'site-1', buildingId: 'bld-a', floorId: 'flr-01', wingId: 'wng-a' }]);
    expect(req.request.body.secretaries).toEqual([{ secretaryEmployeeId: 'emp-mgr' }]);
    req.flush({ success: true, data: null });

    expect(dialogRefCloseSpy).toHaveBeenCalledWith(true);
  });

  it('surfaces the real backend self-reporting rejection message', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    flushMasterData();
    const component = fixture.componentInstance as TestableEmployeeFormDialog;

    component.form.patchValue({ companyId: 'co-1', employeeCode: 'EMP0100', fullName: 'New Employee' });
    component.onSubmit();

    const req = httpMock.expectOne(apiUrl('master/employee/save-with-assignments'));
    req.flush({ success: false, message: 'An employee cannot report to themself.', data: null });

    expect(component.errorMessage()).toBe('An employee cannot report to themself.');
    expect(dialogRefCloseSpy).not.toHaveBeenCalled();
  });

  it('restores the saved row on Edit and submits with the existing employeeId', () => {
    const existingRow: EmployeeRow = { employeeId: 'emp-1', companyId: 'co-1', employeeCode: 'EMP0002', fullName: 'Demo Employee', isActive: true };
    const fixture = createComponent({ row: existingRow, mode: 'edit' });
    flushMasterData();
    httpMock.expectOne(apiUrl('master/employee/assignments/get')).flush({ success: true, data: { locations: [], secretaries: [] } });
    const component = fixture.componentInstance as TestableEmployeeFormDialog;

    expect(component.form.get('companyId')?.value).toBe('co-1');
    expect(component.form.get('employeeCode')?.value).toBe('EMP0002');

    component.onSubmit();

    const req = httpMock.expectOne(apiUrl('master/employee/save-with-assignments'));
    expect(req.request.body.employeeId).toBe('emp-1');
    req.flush({ success: true, data: null });

    expect(dialogRefCloseSpy).toHaveBeenCalledWith(true);
  });

  it('Remarks always starts blank, even when editing an existing row', () => {
    const existingRow: EmployeeRow = { employeeId: 'emp-1', companyId: 'co-1', employeeCode: 'EMP0002', fullName: 'Demo Employee', isActive: true };
    const fixture = createComponent({ row: existingRow, mode: 'edit' });
    flushMasterData();
    httpMock.expectOne(apiUrl('master/employee/assignments/get')).flush({ success: true, data: { locations: [], secretaries: [] } });
    const component = fixture.componentInstance as TestableEmployeeFormDialog;

    expect(component.form.get('remarks')?.value).toBe('');
  });
});
