import { TestBed } from '@angular/core/testing';
import { DIALOG_DATA } from '../../../shared/ui/dialog/dialog-data.token';
import { DialogRef } from '../../../shared/ui/dialog/dialog-ref';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { FormGroup } from '@angular/forms';
import { CompanyFormDialogComponent, CompanyFormDialogData } from './company-form-dialog.component';
import { ConfigService } from '../../../core/services/config.service';
import { CompanyRow } from './company.model';
import { SelectOption } from '../../../shared/ui/form/select.component';
import { provideAppIcons } from '../../../shared/ui/icon/lucide-icons.provider';

type TestableCompanyFormDialog = CompanyFormDialogComponent & {
  form: FormGroup;
  companyGroupOptions: () => SelectOption[];
};

const COMPANY_GROUP_ROWS = [
  { CompanyGroupId: 'cg-demo', CompanyGroupCode: 'DEMO-GRP', CompanyGroupName: 'Demo Group', IsActive: true },
  { CompanyGroupId: 'cg-inactive', CompanyGroupCode: 'OLD-GRP', CompanyGroupName: 'Old Group', IsActive: false },
];

// Covers the Company Group dependency this task calls out as important
// (active-only eligibility, combined "Name (Code)" label, correct ID
// submitted — never a display name), required-field validation (Company
// Group/Code/Name mandatory in the UI even though the real backend itself
// does not enforce Company Group — CONFIRMED LIVE via a probe that
// omitted it and still succeeded), trim-on-submit, and the Edit flow
// restoring the saved row and echoing the existing companyId back on
// update.
describe('CompanyFormDialogComponent', () => {
  let httpMock: HttpTestingController;
  let dialogRefCloseSpy: ReturnType<typeof vi.fn>;

  function apiUrl(path: string): string {
    return `${TestBed.inject(ConfigService).getApiUrl()}${path}`;
  }

  function createComponent(data: CompanyFormDialogData) {
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
    const fixture = TestBed.createComponent(CompanyFormDialogComponent);
    fixture.detectChanges();
    return fixture;
  }

  function flushLookups(groups: Record<string, unknown>[] = COMPANY_GROUP_ROWS) {
    httpMock.expectOne(apiUrl('master/companygroup/get')).flush({ success: true, data: groups });
  }

  afterEach(() => httpMock.verify());

  it('only offers active company groups', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    flushLookups();
    const component = fixture.componentInstance as TestableCompanyFormDialog;

    expect(component.companyGroupOptions().map((o) => o.label)).toEqual(['Demo Group (DEMO-GRP)']);
  });

  it('preserves a saved Company Group that is no longer active when editing', () => {
    const existingRow: CompanyRow = { companyId: 'c1', companyGroupId: 'cg-inactive', companyCode: 'OLD-CO', companyName: 'Old Company', isActive: true };
    const fixture = createComponent({ row: existingRow, mode: 'edit' });
    flushLookups();
    const component = fixture.componentInstance as TestableCompanyFormDialog;

    expect(component.companyGroupOptions().map((o) => o.label)).toContain('Old Group (OLD-GRP)');
    expect(component.form.get('companyGroupId')?.value).toBe('cg-inactive');
  });

  it('does not submit when Company Group/Company Code/Company Name are empty (UI-enforced, even though the real backend does not require Company Group)', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    flushLookups();
    const component = fixture.componentInstance as TestableCompanyFormDialog;

    component.onSubmit();

    expect(dialogRefCloseSpy).not.toHaveBeenCalled();
    httpMock.expectNone(apiUrl('master/company/add'));
  });

  it('trims leading/trailing spaces from Company Code, Company Name and Legal Name on submit', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    flushLookups();
    const component = fixture.componentInstance as TestableCompanyFormDialog;

    component.form.patchValue({ companyGroupId: 'cg-demo', companyCode: '  ACME  ', companyName: '  Acme Corp  ', legalName: '  Acme Corporation Ltd  ' });
    component.onSubmit();

    const req = httpMock.expectOne(apiUrl('master/company/add'));
    expect(req.request.body.companyCode).toBe('ACME');
    expect(req.request.body.companyName).toBe('Acme Corp');
    expect(req.request.body.legalName).toBe('Acme Corporation Ltd');
    req.flush({ success: true, data: null });

    expect(dialogRefCloseSpy).toHaveBeenCalledWith(true);
  });

  it('submits the correct Company Group ID, not a display name', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    flushLookups();
    const component = fixture.componentInstance as TestableCompanyFormDialog;

    component.form.patchValue({ companyGroupId: 'cg-demo', companyCode: 'ACME', companyName: 'Acme Corp' });
    component.onSubmit();

    const req = httpMock.expectOne(apiUrl('master/company/add'));
    expect(req.request.body.companyGroupId).toBe('cg-demo');
    expect(req.request.body.companyId).toBeNull();
    req.flush({ success: true, data: null });
  });

  it('submits optional fields as null when left empty', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    flushLookups();
    const component = fixture.componentInstance as TestableCompanyFormDialog;

    component.form.patchValue({ companyGroupId: 'cg-demo', companyCode: 'ACME', companyName: 'Acme Corp' });
    component.onSubmit();

    const req = httpMock.expectOne(apiUrl('master/company/add'));
    expect(req.request.body.legalName).toBeNull();
    expect(req.request.body.registrationNo).toBeNull();
    expect(req.request.body.taxRegistrationNo).toBeNull();
    req.flush({ success: true, data: null });
  });

  it('submits to master/company/edit with the existing companyId and restores the saved relationship', () => {
    const existingRow: CompanyRow = { companyId: 'c1', companyGroupId: 'cg-demo', companyCode: 'ACME', companyName: 'Acme Corp', legalName: 'Acme Corporation Ltd', registrationNo: 'REG-1', taxRegistrationNo: 'GST-1', isActive: true };
    const fixture = createComponent({ row: existingRow, mode: 'edit' });
    flushLookups();
    const component = fixture.componentInstance as TestableCompanyFormDialog;

    expect(component.form.get('companyGroupId')?.value).toBe('cg-demo');
    expect(component.form.get('legalName')?.value).toBe('Acme Corporation Ltd');

    component.onSubmit();

    const req = httpMock.expectOne(apiUrl('master/company/edit'));
    expect(req.request.body.companyId).toBe('c1');
    req.flush({ success: true, data: null });

    expect(dialogRefCloseSpy).toHaveBeenCalledWith(true);
  });

  it('Remarks always starts blank, even when editing an existing row', () => {
    const existingRow: CompanyRow = { companyId: 'c1', companyGroupId: 'cg-demo', companyCode: 'ACME', companyName: 'Acme Corp', isActive: true };
    const fixture = createComponent({ row: existingRow, mode: 'edit' });
    flushLookups();
    const component = fixture.componentInstance as TestableCompanyFormDialog;

    expect(component.form.get('remarks')?.value).toBe('');
  });
});
