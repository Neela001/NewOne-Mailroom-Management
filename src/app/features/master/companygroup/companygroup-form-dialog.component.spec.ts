import { TestBed } from '@angular/core/testing';
import { DIALOG_DATA } from '../../../shared/ui/dialog/dialog-data.token';
import { DialogRef } from '../../../shared/ui/dialog/dialog-ref';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { FormGroup } from '@angular/forms';
import { CompanyGroupFormDialogComponent, CompanyGroupFormDialogData } from './companygroup-form-dialog.component';
import { ConfigService } from '../../../core/services/config.service';
import { CompanyGroupRow } from './companygroup.model';
import { provideAppIcons } from '../../../shared/ui/icon/lucide-icons.provider';

type TestableCompanyGroupFormDialog = CompanyGroupFormDialogComponent & {
  form: FormGroup;
  errorMessage: () => string | null;
};

// Covers required-field validation, trim-on-submit, the real
// confirmed-live backend duplicate-code rejection surfacing through this
// dialog's own errorMessage signal, and the Edit flow restoring the saved
// row and echoing the existing companyGroupId back on update.
describe('CompanyGroupFormDialogComponent', () => {
  let httpMock: HttpTestingController;
  let dialogRefCloseSpy: ReturnType<typeof vi.fn>;

  function apiUrl(path: string): string {
    return `${TestBed.inject(ConfigService).getApiUrl()}${path}`;
  }

  function createComponent(data: CompanyGroupFormDialogData) {
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
    const fixture = TestBed.createComponent(CompanyGroupFormDialogComponent);
    fixture.detectChanges();
    return fixture;
  }

  afterEach(() => httpMock.verify());

  it('does not submit when Company Group Code/Name are empty', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    const component = fixture.componentInstance as TestableCompanyGroupFormDialog;

    component.onSubmit();

    expect(dialogRefCloseSpy).not.toHaveBeenCalled();
    httpMock.expectNone(apiUrl('master/companygroup/add'));
  });

  it('trims leading/trailing spaces from Company Group Code and Name on submit', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    const component = fixture.componentInstance as TestableCompanyGroupFormDialog;

    component.form.patchValue({ companyGroupCode: '  NOE  ', companyGroupName: '  NOE Holdings  ' });
    component.onSubmit();

    const req = httpMock.expectOne(apiUrl('master/companygroup/add'));
    expect(req.request.body.companyGroupCode).toBe('NOE');
    expect(req.request.body.companyGroupName).toBe('NOE Holdings');
    req.flush({ success: true, data: null });

    expect(dialogRefCloseSpy).toHaveBeenCalledWith(true);
  });

  it('submits to master/companygroup/add with companyGroupId null', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    const component = fixture.componentInstance as TestableCompanyGroupFormDialog;

    component.form.patchValue({ companyGroupCode: 'NOE', companyGroupName: 'NOE Holdings' });
    component.onSubmit();

    const req = httpMock.expectOne(apiUrl('master/companygroup/add'));
    expect(req.request.body.companyGroupId).toBeNull();
    req.flush({ success: true, data: null });
  });

  it('surfaces the real backend duplicate-code rejection message', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    const component = fixture.componentInstance as TestableCompanyGroupFormDialog;

    component.form.patchValue({ companyGroupCode: 'DEMO-GRP', companyGroupName: 'Another Demo' });
    component.onSubmit();

    const req = httpMock.expectOne(apiUrl('master/companygroup/add'));
    req.flush({ success: false, message: 'Duplicate record already exists.', data: null });

    expect(component.errorMessage()).toBe('Duplicate record already exists.');
    expect(dialogRefCloseSpy).not.toHaveBeenCalled();
  });

  it('restores the saved row on Edit and submits to master/companygroup/edit with the existing companyGroupId', () => {
    const existingRow: CompanyGroupRow = { companyGroupId: 'cg1', companyGroupCode: 'DEMO-GRP', companyGroupName: 'Demo Group', isActive: true };
    const fixture = createComponent({ row: existingRow, mode: 'edit' });
    const component = fixture.componentInstance as TestableCompanyGroupFormDialog;

    expect(component.form.get('companyGroupCode')?.value).toBe('DEMO-GRP');
    expect(component.form.get('companyGroupName')?.value).toBe('Demo Group');

    component.onSubmit();

    const req = httpMock.expectOne(apiUrl('master/companygroup/edit'));
    expect(req.request.body.companyGroupId).toBe('cg1');
    req.flush({ success: true, data: null });

    expect(dialogRefCloseSpy).toHaveBeenCalledWith(true);
  });

  it('Remarks always starts blank, even when editing an existing row', () => {
    const existingRow: CompanyGroupRow = { companyGroupId: 'cg1', companyGroupCode: 'DEMO-GRP', companyGroupName: 'Demo Group', isActive: true };
    const fixture = createComponent({ row: existingRow, mode: 'edit' });
    const component = fixture.componentInstance as TestableCompanyGroupFormDialog;

    expect(component.form.get('remarks')?.value).toBe('');
  });
});
