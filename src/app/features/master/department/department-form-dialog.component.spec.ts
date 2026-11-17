import { TestBed } from '@angular/core/testing';
import { DIALOG_DATA } from '../../../shared/ui/dialog/dialog-data.token';
import { DialogRef } from '../../../shared/ui/dialog/dialog-ref';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { FormGroup } from '@angular/forms';
import { DepartmentFormDialogComponent, DepartmentFormDialogData } from './department-form-dialog.component';
import { ConfigService } from '../../../core/services/config.service';
import { DepartmentRow } from './department.model';
import { SelectOption } from '../../../shared/ui/form/select.component';
import { provideAppIcons } from '../../../shared/ui/icon/lucide-icons.provider';

type TestableDepartmentFormDialog = DepartmentFormDialogComponent & {
  form: FormGroup;
  companyOptions: () => SelectOption[];
  divisionOptions: () => SelectOption[];
  helperText: () => string;
  errorMessage: () => string | null;
};

const COMPANY_ROWS = [
  { CompanyId: 'co-demo', CompanyCode: 'DEMO-COMP', CompanyName: 'Demo Technologies Pvt Ltd', IsActive: true },
  { CompanyId: 'co-other', CompanyCode: 'OTHER-CO', CompanyName: 'Other Company', IsActive: true },
];
const DIVISION_ROWS = [
  { DivisionId: 'div-tech', CompanyId: 'co-demo', DivisionCode: 'TECH', DivisionName: 'Technology', IsActive: true },
  { DivisionId: 'div-other', CompanyId: 'co-other', DivisionCode: 'OPS', DivisionName: 'Operations', IsActive: true },
];

// Covers the Company -> Division dependency this task calls out as
// mandatory (Division disabled until Company is selected, client-side
// filtered to that Company's own real divisions — never showing another
// Company's divisions), required-field validation, trim-on-submit, the
// dynamic footer helper text, the real confirmed-live backend duplicate-
// code rejection, and the Edit flow restoring the saved row.
describe('DepartmentFormDialogComponent', () => {
  let httpMock: HttpTestingController;
  let dialogRefCloseSpy: ReturnType<typeof vi.fn>;

  function apiUrl(path: string): string {
    return `${TestBed.inject(ConfigService).getApiUrl()}${path}`;
  }

  function createComponent(data: DepartmentFormDialogData) {
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
    const fixture = TestBed.createComponent(DepartmentFormDialogComponent);
    fixture.detectChanges();
    return fixture;
  }

  function flushLookups(companies: Record<string, unknown>[] = COMPANY_ROWS, divisions: Record<string, unknown>[] = DIVISION_ROWS) {
    httpMock.expectOne(apiUrl('master/company/get')).flush({ success: true, data: companies });
    httpMock.expectOne(apiUrl('master/division/get')).flush({ success: true, data: divisions });
  }

  afterEach(() => httpMock.verify());

  it('keeps Division disabled and empty, and shows "Select Company and Division." before a Company is selected', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    flushLookups();
    const component = fixture.componentInstance as TestableDepartmentFormDialog;

    expect(component.form.get('divisionId')?.disabled).toBe(true);
    expect(component.divisionOptions()).toEqual([]);
    expect(component.helperText()).toBe('Select Company and Division.');
  });

  it('enables Division and loads only the selected Company\'s own divisions, never another Company\'s', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    flushLookups();
    const component = fixture.componentInstance as TestableDepartmentFormDialog;

    component.form.get('companyId')!.setValue('co-demo');

    expect(component.form.get('divisionId')?.disabled).toBe(false);
    expect(component.divisionOptions().map((o) => o.label)).toEqual(['Technology (TECH)']);
    expect(component.helperText()).toBe('Select Company and Division.');

    component.form.get('divisionId')!.setValue('div-tech');
    expect(component.helperText()).toBe('Ready');
  });

  it('clears Division when Company changes, and reloads options for the new Company', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    flushLookups();
    const component = fixture.componentInstance as TestableDepartmentFormDialog;

    component.form.get('companyId')!.setValue('co-demo');
    component.form.get('divisionId')!.setValue('div-tech');

    component.form.get('companyId')!.setValue('co-other');
    expect(component.form.get('divisionId')?.value).toBe('');
    expect(component.divisionOptions().map((o) => o.label)).toEqual(['Operations (OPS)']);
  });

  it('does not submit when Company/Division/Department Code/Department Name are empty', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    flushLookups();
    const component = fixture.componentInstance as TestableDepartmentFormDialog;

    component.onSubmit();

    expect(dialogRefCloseSpy).not.toHaveBeenCalled();
    httpMock.expectNone(apiUrl('master/department/add'));
  });

  it('trims leading/trailing spaces from Department Code and Department Name on submit', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    flushLookups();
    const component = fixture.componentInstance as TestableDepartmentFormDialog;

    component.form.get('companyId')!.setValue('co-demo');
    component.form.patchValue({ divisionId: 'div-tech', departmentCode: '  DEV  ', departmentName: '  Software Development  ' });
    component.onSubmit();

    const req = httpMock.expectOne(apiUrl('master/department/add'));
    expect(req.request.body.departmentCode).toBe('DEV');
    expect(req.request.body.departmentName).toBe('Software Development');
    req.flush({ success: true, data: null });

    expect(dialogRefCloseSpy).toHaveBeenCalledWith(true);
  });

  it('submits the correct Company and Division IDs, not display names', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    flushLookups();
    const component = fixture.componentInstance as TestableDepartmentFormDialog;

    component.form.get('companyId')!.setValue('co-demo');
    component.form.patchValue({ divisionId: 'div-tech', departmentCode: 'DEV', departmentName: 'Software Development' });
    component.onSubmit();

    const req = httpMock.expectOne(apiUrl('master/department/add'));
    expect(req.request.body.companyId).toBe('co-demo');
    expect(req.request.body.divisionId).toBe('div-tech');
    expect(req.request.body.departmentId).toBeNull();
    req.flush({ success: true, data: null });
  });

  it('surfaces the real backend duplicate-code rejection message', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    flushLookups();
    const component = fixture.componentInstance as TestableDepartmentFormDialog;

    component.form.get('companyId')!.setValue('co-demo');
    component.form.patchValue({ divisionId: 'div-tech', departmentCode: 'DEV', departmentName: 'Software Development' });
    component.onSubmit();

    const req = httpMock.expectOne(apiUrl('master/department/add'));
    req.flush({ success: false, message: 'Duplicate record already exists.', data: null });

    expect(component.errorMessage()).toBe('Duplicate record already exists.');
    expect(dialogRefCloseSpy).not.toHaveBeenCalled();
  });

  it('restores the saved Company and Division on Edit and submits to master/department/edit with the existing departmentId', () => {
    const existingRow: DepartmentRow = { departmentId: 'dep1', companyId: 'co-demo', divisionId: 'div-tech', departmentCode: 'DEV', departmentName: 'Software Development', isActive: true };
    const fixture = createComponent({ row: existingRow, mode: 'edit' });
    flushLookups();
    const component = fixture.componentInstance as TestableDepartmentFormDialog;

    expect(component.form.get('companyId')?.value).toBe('co-demo');
    expect(component.form.get('divisionId')?.value).toBe('div-tech');
    expect(component.form.get('divisionId')?.disabled).toBe(false);

    component.onSubmit();

    const req = httpMock.expectOne(apiUrl('master/department/edit'));
    expect(req.request.body.departmentId).toBe('dep1');
    req.flush({ success: true, data: null });

    expect(dialogRefCloseSpy).toHaveBeenCalledWith(true);
  });

  it('Remarks always starts blank, even when editing an existing row', () => {
    const existingRow: DepartmentRow = { departmentId: 'dep1', companyId: 'co-demo', divisionId: 'div-tech', departmentCode: 'DEV', departmentName: 'Software Development', isActive: true };
    const fixture = createComponent({ row: existingRow, mode: 'edit' });
    flushLookups();
    const component = fixture.componentInstance as TestableDepartmentFormDialog;

    expect(component.form.get('remarks')?.value).toBe('');
  });
});
