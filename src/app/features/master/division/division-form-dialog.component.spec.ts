import { TestBed } from '@angular/core/testing';
import { DIALOG_DATA } from '../../../shared/ui/dialog/dialog-data.token';
import { DialogRef } from '../../../shared/ui/dialog/dialog-ref';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { FormGroup } from '@angular/forms';
import { DivisionFormDialogComponent, DivisionFormDialogData } from './division-form-dialog.component';
import { ConfigService } from '../../../core/services/config.service';
import { DivisionRow } from './division.model';
import { SelectOption } from '../../../shared/ui/form/select.component';
import { provideAppIcons } from '../../../shared/ui/icon/lucide-icons.provider';

type TestableDivisionFormDialog = DivisionFormDialogComponent & {
  form: FormGroup;
  companyOptions: () => SelectOption[];
  errorMessage: () => string | null;
};

const COMPANY_ROWS = [
  { CompanyId: 'co-demo', CompanyCode: 'DEMO-COMP', CompanyName: 'Demo Technologies Pvt Ltd', IsActive: true },
  { CompanyId: 'co-inactive', CompanyCode: 'OLD-CO', CompanyName: 'Old Company', IsActive: false },
];

// Covers the Company dependency this task calls out as mandatory
// (active-only eligibility, combined "Name (Code)" label, correct ID
// submitted — never a display name), required-field validation,
// trim-on-submit, the real confirmed-live backend duplicate-code
// rejection surfacing through this dialog's own errorMessage signal, and
// the Edit flow restoring the saved row and echoing the existing
// divisionId back on update.
describe('DivisionFormDialogComponent', () => {
  let httpMock: HttpTestingController;
  let dialogRefCloseSpy: ReturnType<typeof vi.fn>;

  function apiUrl(path: string): string {
    return `${TestBed.inject(ConfigService).getApiUrl()}${path}`;
  }

  function createComponent(data: DivisionFormDialogData) {
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
    const fixture = TestBed.createComponent(DivisionFormDialogComponent);
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
    const component = fixture.componentInstance as TestableDivisionFormDialog;

    expect(component.companyOptions().map((o) => o.label)).toEqual(['Demo Technologies Pvt Ltd (DEMO-COMP)']);
  });

  it('preserves a saved Company that is no longer active when editing', () => {
    const existingRow: DivisionRow = { divisionId: 'd1', companyId: 'co-inactive', divisionCode: 'OLD', divisionName: 'Old Division', isActive: true };
    const fixture = createComponent({ row: existingRow, mode: 'edit' });
    flushLookups();
    const component = fixture.componentInstance as TestableDivisionFormDialog;

    expect(component.companyOptions().map((o) => o.label)).toContain('Old Company (OLD-CO)');
    expect(component.form.get('companyId')?.value).toBe('co-inactive');
  });

  it('does not submit when Company/Division Code/Division Name are empty', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    flushLookups();
    const component = fixture.componentInstance as TestableDivisionFormDialog;

    component.onSubmit();

    expect(dialogRefCloseSpy).not.toHaveBeenCalled();
    httpMock.expectNone(apiUrl('master/division/add'));
  });

  it('trims leading/trailing spaces from Division Code and Division Name on submit', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    flushLookups();
    const component = fixture.componentInstance as TestableDivisionFormDialog;

    component.form.patchValue({ companyId: 'co-demo', divisionCode: '  TECH  ', divisionName: '  Technology  ' });
    component.onSubmit();

    const req = httpMock.expectOne(apiUrl('master/division/add'));
    expect(req.request.body.divisionCode).toBe('TECH');
    expect(req.request.body.divisionName).toBe('Technology');
    req.flush({ success: true, data: null });

    expect(dialogRefCloseSpy).toHaveBeenCalledWith(true);
  });

  it('submits the correct Company ID, not a display name', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    flushLookups();
    const component = fixture.componentInstance as TestableDivisionFormDialog;

    component.form.patchValue({ companyId: 'co-demo', divisionCode: 'TECH', divisionName: 'Technology' });
    component.onSubmit();

    const req = httpMock.expectOne(apiUrl('master/division/add'));
    expect(req.request.body.companyId).toBe('co-demo');
    expect(req.request.body.divisionId).toBeNull();
    req.flush({ success: true, data: null });
  });

  it('surfaces the real backend duplicate-code rejection message', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    flushLookups();
    const component = fixture.componentInstance as TestableDivisionFormDialog;

    component.form.patchValue({ companyId: 'co-demo', divisionCode: 'TECH', divisionName: 'Technology' });
    component.onSubmit();

    const req = httpMock.expectOne(apiUrl('master/division/add'));
    req.flush({ success: false, message: 'Duplicate record already exists.', data: null });

    expect(component.errorMessage()).toBe('Duplicate record already exists.');
    expect(dialogRefCloseSpy).not.toHaveBeenCalled();
  });

  it('restores the saved row on Edit and submits to master/division/edit with the existing divisionId', () => {
    const existingRow: DivisionRow = { divisionId: 'd1', companyId: 'co-demo', divisionCode: 'TECH', divisionName: 'Technology', isActive: true };
    const fixture = createComponent({ row: existingRow, mode: 'edit' });
    flushLookups();
    const component = fixture.componentInstance as TestableDivisionFormDialog;

    expect(component.form.get('companyId')?.value).toBe('co-demo');
    expect(component.form.get('divisionCode')?.value).toBe('TECH');
    expect(component.form.get('divisionName')?.value).toBe('Technology');

    component.onSubmit();

    const req = httpMock.expectOne(apiUrl('master/division/edit'));
    expect(req.request.body.divisionId).toBe('d1');
    req.flush({ success: true, data: null });

    expect(dialogRefCloseSpy).toHaveBeenCalledWith(true);
  });

  it('Remarks always starts blank, even when editing an existing row', () => {
    const existingRow: DivisionRow = { divisionId: 'd1', companyId: 'co-demo', divisionCode: 'TECH', divisionName: 'Technology', isActive: true };
    const fixture = createComponent({ row: existingRow, mode: 'edit' });
    flushLookups();
    const component = fixture.componentInstance as TestableDivisionFormDialog;

    expect(component.form.get('remarks')?.value).toBe('');
  });
});
