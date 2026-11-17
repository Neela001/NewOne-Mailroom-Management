import { TestBed } from '@angular/core/testing';
import { DIALOG_DATA } from '../../../shared/ui/dialog/dialog-data.token';
import { DialogRef } from '../../../shared/ui/dialog/dialog-ref';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { FormGroup } from '@angular/forms';
import { DesignationFormDialogComponent, DesignationFormDialogData } from './designation-form-dialog.component';
import { ConfigService } from '../../../core/services/config.service';
import { DesignationRow } from './designation.model';
import { SelectOption } from '../../../shared/ui/form/select.component';
import { provideAppIcons } from '../../../shared/ui/icon/lucide-icons.provider';

type TestableDesignationFormDialog = DesignationFormDialogComponent & {
  form: FormGroup;
  companyOptions: () => SelectOption[];
  helperText: () => string;
  specifyLevelChecked: () => boolean;
  errorMessage: () => string | null;
};

const COMPANY_ROWS = [
  { CompanyId: 'co-demo', CompanyCode: 'DEMO-COMP', CompanyName: 'Demo Technologies Pvt Ltd', IsActive: true },
  { CompanyId: 'co-inactive', CompanyCode: 'OLD-CO', CompanyName: 'Old Company', IsActive: false },
];

// Covers the Company dependency (active-only eligibility, preserve
// saved-but-inactive), required-field validation, and — the real focus
// of this task — the "Specify level" checkbox's CONFIRMED LIVE backend
// semantics (see designation.model.ts's own class-level comment): a
// plain nullable int32 with NO separate backend flag, where checked
// sends the real typed number (including 0/negative) and unchecked sends
// an explicit null, never a silently-coerced 0.
describe('DesignationFormDialogComponent', () => {
  let httpMock: HttpTestingController;
  let dialogRefCloseSpy: ReturnType<typeof vi.fn>;

  function apiUrl(path: string): string {
    return `${TestBed.inject(ConfigService).getApiUrl()}${path}`;
  }

  function createComponent(data: DesignationFormDialogData) {
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
    const fixture = TestBed.createComponent(DesignationFormDialogComponent);
    fixture.detectChanges();
    return fixture;
  }

  function flushLookups(companies: Record<string, unknown>[] = COMPANY_ROWS) {
    httpMock.expectOne(apiUrl('master/company/get')).flush({ success: true, data: companies });
  }

  afterEach(() => httpMock.verify());

  it('only offers active companies', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    flushLookups();
    const component = fixture.componentInstance as TestableDesignationFormDialog;

    expect(component.companyOptions().map((o) => o.label)).toEqual(['Demo Technologies Pvt Ltd (DEMO-COMP)']);
  });

  it('preserves a saved Company that is no longer active when editing', () => {
    const existingRow: DesignationRow = { designationId: 'd1', companyId: 'co-inactive', designationCode: 'OLD', designationName: 'Old Designation', designationLevel: null, isActive: true };
    const fixture = createComponent({ row: existingRow, mode: 'edit' });
    flushLookups();
    const component = fixture.componentInstance as TestableDesignationFormDialog;

    expect(component.companyOptions().map((o) => o.label)).toContain('Old Company (OLD-CO)');
    expect(component.form.get('companyId')?.value).toBe('co-inactive');
  });

  it('does not submit when Company/Designation Code/Designation Name are empty', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    flushLookups();
    const component = fixture.componentInstance as TestableDesignationFormDialog;

    component.onSubmit();

    expect(dialogRefCloseSpy).not.toHaveBeenCalled();
    httpMock.expectNone(apiUrl('master/designation/add'));
  });

  it('"Specify level" is checked by default in Add mode, with the Level input enabled', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    flushLookups();
    const component = fixture.componentInstance as TestableDesignationFormDialog;

    expect(component.specifyLevelChecked()).toBe(true);
    expect(component.form.get('designationLevel')!.disabled).toBe(false);
  });

  it('sends the real typed Level, including 0, when "Specify level" is checked', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    flushLookups();
    const component = fixture.componentInstance as TestableDesignationFormDialog;

    component.form.patchValue({ companyId: 'co-demo', designationCode: 'DC-001', designationName: 'Junior Clerk', designationLevel: '0' });
    component.onSubmit();

    const req = httpMock.expectOne(apiUrl('master/designation/add'));
    expect(req.request.body.designationLevel).toBe(0);
    req.flush({ success: true, data: null });
  });

  it('sends the real typed negative Level when "Specify level" is checked', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    flushLookups();
    const component = fixture.componentInstance as TestableDesignationFormDialog;

    component.form.patchValue({ companyId: 'co-demo', designationCode: 'DC-001', designationName: 'Intern', designationLevel: '-1' });
    component.onSubmit();

    const req = httpMock.expectOne(apiUrl('master/designation/add'));
    expect(req.request.body.designationLevel).toBe(-1);
    req.flush({ success: true, data: null });
  });

  it('sends an explicit null — never a coerced 0 — when "Specify level" is unchecked', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    flushLookups();
    const component = fixture.componentInstance as TestableDesignationFormDialog;

    component.form.patchValue({ companyId: 'co-demo', designationCode: 'DC-001', designationName: 'Manager', designationLevel: '5' });
    component.form.get('specifyLevel')!.setValue(false);
    expect(component.form.get('designationLevel')!.disabled).toBe(true);
    component.onSubmit();

    const req = httpMock.expectOne(apiUrl('master/designation/add'));
    expect(req.request.body.designationLevel).toBeNull();
    req.flush({ success: true, data: null });
  });

  it('rejects a decimal Level before it reaches the backend', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    flushLookups();
    const component = fixture.componentInstance as TestableDesignationFormDialog;

    component.form.patchValue({ companyId: 'co-demo', designationCode: 'DC-001', designationName: 'Manager', designationLevel: '2.5' });
    expect(component.form.get('designationLevel')!.invalid).toBe(true);

    component.onSubmit();
    httpMock.expectNone(apiUrl('master/designation/add'));
  });

  it('on Edit, restores "Specify level" unchecked and a blank Level when the saved row has null', () => {
    const existingRow: DesignationRow = { designationId: 'd1', companyId: 'co-demo', designationCode: 'DC-001', designationName: 'Clerk', designationLevel: null, isActive: true };
    const fixture = createComponent({ row: existingRow, mode: 'edit' });
    flushLookups();
    const component = fixture.componentInstance as TestableDesignationFormDialog;

    expect(component.specifyLevelChecked()).toBe(false);
    expect(component.form.get('designationLevel')!.disabled).toBe(true);
    expect(component.form.get('designationLevel')!.value).toBe('');
  });

  it('on Edit, restores "Specify level" checked and the real value when the saved row has 0', () => {
    const existingRow: DesignationRow = { designationId: 'd1', companyId: 'co-demo', designationCode: 'DC-001', designationName: 'Clerk', designationLevel: 0, isActive: true };
    const fixture = createComponent({ row: existingRow, mode: 'edit' });
    flushLookups();
    const component = fixture.componentInstance as TestableDesignationFormDialog;

    expect(component.specifyLevelChecked()).toBe(true);
    expect(component.form.get('designationLevel')!.disabled).toBe(false);
    expect(component.form.get('designationLevel')!.value).toBe('0');
  });

  it('on Edit, restores a saved negative Level correctly', () => {
    const existingRow: DesignationRow = { designationId: 'd1', companyId: 'co-demo', designationCode: 'DC-001', designationName: 'Clerk', designationLevel: -3, isActive: true };
    const fixture = createComponent({ row: existingRow, mode: 'edit' });
    flushLookups();
    const component = fixture.componentInstance as TestableDesignationFormDialog;

    expect(component.specifyLevelChecked()).toBe(true);
    expect(component.form.get('designationLevel')!.value).toBe('-3');
  });

  it('restores the saved row on Edit and submits to master/designation/edit with the existing designationId', () => {
    const existingRow: DesignationRow = { designationId: 'd1', companyId: 'co-demo', designationCode: 'DC-001', designationName: 'Manager', designationLevel: 5, isActive: true };
    const fixture = createComponent({ row: existingRow, mode: 'edit' });
    flushLookups();
    const component = fixture.componentInstance as TestableDesignationFormDialog;

    expect(component.form.get('companyId')?.value).toBe('co-demo');
    expect(component.form.get('designationCode')?.value).toBe('DC-001');

    component.onSubmit();

    const req = httpMock.expectOne(apiUrl('master/designation/edit'));
    expect(req.request.body.designationId).toBe('d1');
    expect(req.request.body.designationLevel).toBe(5);
    req.flush({ success: true, data: null });

    expect(dialogRefCloseSpy).toHaveBeenCalledWith(true);
  });

  it('surfaces the real backend rejection message', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    flushLookups();
    const component = fixture.componentInstance as TestableDesignationFormDialog;

    component.form.patchValue({ companyId: 'co-demo', designationCode: 'DC-001', designationName: 'Manager' });
    component.onSubmit();

    const req = httpMock.expectOne(apiUrl('master/designation/add'));
    req.flush({ success: false, message: 'Duplicate record already exists.', data: null });

    expect(component.errorMessage()).toBe('Duplicate record already exists.');
    expect(dialogRefCloseSpy).not.toHaveBeenCalled();
  });

  it('Remarks always starts blank, even when editing an existing row', () => {
    const existingRow: DesignationRow = { designationId: 'd1', companyId: 'co-demo', designationCode: 'DC-001', designationName: 'Manager', designationLevel: 5, isActive: true };
    const fixture = createComponent({ row: existingRow, mode: 'edit' });
    flushLookups();
    const component = fixture.componentInstance as TestableDesignationFormDialog;

    expect(component.form.get('remarks')?.value).toBe('');
  });
});
