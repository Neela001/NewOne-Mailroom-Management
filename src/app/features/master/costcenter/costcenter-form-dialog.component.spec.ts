import { TestBed } from '@angular/core/testing';
import { DIALOG_DATA } from '../../../shared/ui/dialog/dialog-data.token';
import { DialogRef } from '../../../shared/ui/dialog/dialog-ref';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { FormGroup } from '@angular/forms';
import { CostCenterFormDialogComponent, CostCenterFormDialogData } from './costcenter-form-dialog.component';
import { ConfigService } from '../../../core/services/config.service';
import { CostCenterRow } from './costcenter.model';
import { SelectOption } from '../../../shared/ui/form/select.component';
import { provideAppIcons } from '../../../shared/ui/icon/lucide-icons.provider';

type TestableCostCenterFormDialog = CostCenterFormDialogComponent & {
  form: FormGroup;
  companyOptions: () => SelectOption[];
  helperText: () => string;
  errorMessage: () => string | null;
};

const COMPANY_ROWS = [
  { CompanyId: 'co-demo', CompanyCode: 'DEMO-COMP', CompanyName: 'Demo Technologies Pvt Ltd', IsActive: true },
  { CompanyId: 'co-inactive', CompanyCode: 'OLD-CO', CompanyName: 'Old Company', IsActive: false },
];

// Covers the Company dependency this task calls out as mandatory
// (active-only eligibility, combined "Name (Code)" label, correct ID
// submitted — never a display name), required-field validation,
// trim-on-submit, the dynamic footer helper text, the real confirmed-live
// backend duplicate-code rejection, and the Edit flow restoring the saved
// row and echoing the existing costCenterId back on update.
describe('CostCenterFormDialogComponent', () => {
  let httpMock: HttpTestingController;
  let dialogRefCloseSpy: ReturnType<typeof vi.fn>;

  function apiUrl(path: string): string {
    return `${TestBed.inject(ConfigService).getApiUrl()}${path}`;
  }

  function createComponent(data: CostCenterFormDialogData) {
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
    const fixture = TestBed.createComponent(CostCenterFormDialogComponent);
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
    const component = fixture.componentInstance as TestableCostCenterFormDialog;

    expect(component.companyOptions().map((o) => o.label)).toEqual(['Demo Technologies Pvt Ltd (DEMO-COMP)']);
  });

  it('shows the dynamic footer helper text, switching to "Ready" once a Company is selected', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    flushLookups();
    const component = fixture.componentInstance as TestableCostCenterFormDialog;

    expect(component.helperText()).toBe('Select Company, then enter the Cost Center details.');
    component.form.get('companyId')!.setValue('co-demo');
    expect(component.helperText()).toBe('Ready');
  });

  it('preserves a saved Company that is no longer active when editing', () => {
    const existingRow: CostCenterRow = { costCenterId: 'cc1', companyId: 'co-inactive', costCenterCode: 'OLD', costCenterName: 'Old Cost Center', isActive: true };
    const fixture = createComponent({ row: existingRow, mode: 'edit' });
    flushLookups();
    const component = fixture.componentInstance as TestableCostCenterFormDialog;

    expect(component.companyOptions().map((o) => o.label)).toContain('Old Company (OLD-CO)');
    expect(component.form.get('companyId')?.value).toBe('co-inactive');
  });

  it('does not submit when Company/Cost Center Code/Cost Center Name are empty', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    flushLookups();
    const component = fixture.componentInstance as TestableCostCenterFormDialog;

    component.onSubmit();

    expect(dialogRefCloseSpy).not.toHaveBeenCalled();
    httpMock.expectNone(apiUrl('master/costcenter/add'));
  });

  it('trims leading/trailing spaces from Cost Center Code and Cost Center Name on submit', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    flushLookups();
    const component = fixture.componentInstance as TestableCostCenterFormDialog;

    component.form.patchValue({ companyId: 'co-demo', costCenterCode: '  CC-001  ', costCenterName: '  Technology Cost Center  ' });
    component.onSubmit();

    const req = httpMock.expectOne(apiUrl('master/costcenter/add'));
    expect(req.request.body.costCenterCode).toBe('CC-001');
    expect(req.request.body.costCenterName).toBe('Technology Cost Center');
    req.flush({ success: true, data: null });

    expect(dialogRefCloseSpy).toHaveBeenCalledWith(true);
  });

  it('submits the correct Company ID, not a display name', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    flushLookups();
    const component = fixture.componentInstance as TestableCostCenterFormDialog;

    component.form.patchValue({ companyId: 'co-demo', costCenterCode: 'CC-001', costCenterName: 'Technology Cost Center' });
    component.onSubmit();

    const req = httpMock.expectOne(apiUrl('master/costcenter/add'));
    expect(req.request.body.companyId).toBe('co-demo');
    expect(req.request.body.costCenterId).toBeNull();
    req.flush({ success: true, data: null });
  });

  it('surfaces the real backend duplicate-code rejection message', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    flushLookups();
    const component = fixture.componentInstance as TestableCostCenterFormDialog;

    component.form.patchValue({ companyId: 'co-demo', costCenterCode: 'CC-001', costCenterName: 'Technology Cost Center' });
    component.onSubmit();

    const req = httpMock.expectOne(apiUrl('master/costcenter/add'));
    req.flush({ success: false, message: 'Duplicate record already exists.', data: null });

    expect(component.errorMessage()).toBe('Duplicate record already exists.');
    expect(dialogRefCloseSpy).not.toHaveBeenCalled();
  });

  it('restores the saved row on Edit and submits to master/costcenter/edit with the existing costCenterId', () => {
    const existingRow: CostCenterRow = { costCenterId: 'cc1', companyId: 'co-demo', costCenterCode: 'CC-001', costCenterName: 'Technology Cost Center', isActive: true };
    const fixture = createComponent({ row: existingRow, mode: 'edit' });
    flushLookups();
    const component = fixture.componentInstance as TestableCostCenterFormDialog;

    expect(component.form.get('companyId')?.value).toBe('co-demo');
    expect(component.form.get('costCenterCode')?.value).toBe('CC-001');
    expect(component.helperText()).toBe('Ready');

    component.onSubmit();

    const req = httpMock.expectOne(apiUrl('master/costcenter/edit'));
    expect(req.request.body.costCenterId).toBe('cc1');
    req.flush({ success: true, data: null });

    expect(dialogRefCloseSpy).toHaveBeenCalledWith(true);
  });

  it('Remarks always starts blank, even when editing an existing row', () => {
    const existingRow: CostCenterRow = { costCenterId: 'cc1', companyId: 'co-demo', costCenterCode: 'CC-001', costCenterName: 'Technology Cost Center', isActive: true };
    const fixture = createComponent({ row: existingRow, mode: 'edit' });
    flushLookups();
    const component = fixture.componentInstance as TestableCostCenterFormDialog;

    expect(component.form.get('remarks')?.value).toBe('');
  });
});
