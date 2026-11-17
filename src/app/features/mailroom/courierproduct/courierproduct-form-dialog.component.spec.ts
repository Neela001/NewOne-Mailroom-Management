import { TestBed } from '@angular/core/testing';
import { DIALOG_DATA } from '../../../shared/ui/dialog/dialog-data.token';
import { DialogRef } from '../../../shared/ui/dialog/dialog-ref';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { FormGroup } from '@angular/forms';
import { CourierProductFormDialogComponent, CourierProductFormDialogData } from './courierproduct-form-dialog.component';
import { ConfigService } from '../../../core/services/config.service';
import { CourierProductRow } from './courierproduct.model';
import { SelectOption } from '../../../shared/ui/form/select.component';
import { provideAppIcons } from '../../../shared/ui/icon/lucide-icons.provider';

type TestableCourierProductFormDialog = CourierProductFormDialogComponent & {
  form: FormGroup;
  modeOptions: () => SelectOption[];
  vendorOptions: () => SelectOption[];
  productGroupOptions: () => SelectOption[];
  serviceTypeOptions: () => SelectOption[];
  errorMessage: () => string | null;
  onSubmit: () => void;
};

const OPTIONS_RESPONSE = {
  modes: [
    { Id: 'mode-cr', Code: 'CR', Name: 'Courier', IsActive: true },
    { Id: 'mode-pt', Code: 'PT', Name: 'Postal', IsActive: true },
  ],
  productGroups: [
    { Id: 'grp-dp', Code: 'DP', Name: 'Doc Air', IsActive: true },
    { Id: 'grp-postal', Code: 'POSTAL', Name: 'Postal', IsActive: false },
  ],
  vendors: [
    { Id: 'vendor-bd', Code: 'BD', Name: 'BlueDart', CourierModeId: 'mode-cr', ServiceType: 'DOMESTIC', IsActive: true },
    { Id: 'vendor-ip', Code: 'IP', Name: 'India Post', CourierModeId: 'mode-pt', ServiceType: 'BOTH', IsActive: true },
  ],
};

// Covers the Mode -> Vendor -> Service Type dependency chain (Service
// Type derived from the Vendor, not independently chosen), required-field
// validation, the real confirmed-live Volumetric Divisor rule (whole
// number, 0 to 99999999999999 — zero valid, decimals and negatives
// rejected), and the Edit flow restoring the saved row.
describe('CourierProductFormDialogComponent', () => {
  let httpMock: HttpTestingController;
  let dialogRefCloseSpy: ReturnType<typeof vi.fn>;

  function apiUrl(path: string): string {
    return `${TestBed.inject(ConfigService).getApiUrl()}${path}`;
  }

  function createComponent(data: CourierProductFormDialogData) {
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
    const fixture = TestBed.createComponent(CourierProductFormDialogComponent);
    fixture.detectChanges();
    return fixture;
  }

  function flushOptions(options: Record<string, unknown> = OPTIONS_RESPONSE) {
    httpMock.expectOne(apiUrl('master/courierproduct/options/get')).flush({ success: true, data: options });
  }

  afterEach(() => httpMock.verify());

  it('keeps Courier Vendor and Service Type disabled until their own dependency is selected', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    flushOptions();
    const component = fixture.componentInstance as TestableCourierProductFormDialog;

    expect(component.form.get('courierVendorId')?.disabled).toBe(true);
    expect(component.form.get('serviceType')?.disabled).toBe(true);

    component.form.get('courierModeId')!.setValue('mode-cr');
    expect(component.form.get('courierVendorId')?.disabled).toBe(false);
    expect(component.vendorOptions().map((o) => o.value)).toEqual(['vendor-bd']);
  });

  it('auto-populates Service Type from the selected Vendor, never independently browsable', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    flushOptions();
    const component = fixture.componentInstance as TestableCourierProductFormDialog;

    component.form.get('courierModeId')!.setValue('mode-cr');
    component.form.get('courierVendorId')!.setValue('vendor-bd');

    expect(component.form.get('serviceType')?.disabled).toBe(false);
    expect(component.form.get('serviceType')?.value).toBe('DOMESTIC');
    expect(component.serviceTypeOptions().map((o) => o.value)).toEqual(['DOMESTIC']);
  });

  it('clears Courier Vendor and Service Type when Courier Mode changes', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    flushOptions();
    const component = fixture.componentInstance as TestableCourierProductFormDialog;

    component.form.get('courierModeId')!.setValue('mode-cr');
    component.form.get('courierVendorId')!.setValue('vendor-bd');

    component.form.get('courierModeId')!.setValue('mode-pt');
    expect(component.form.get('courierVendorId')?.value).toBe('');
    expect(component.form.get('serviceType')?.value).toBe('');
    expect(component.form.get('serviceType')?.disabled).toBe(true);
    expect(component.vendorOptions().map((o) => o.value)).toEqual(['vendor-ip']);
  });

  it('clears Service Type when Courier Vendor changes', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    flushOptions();
    const component = fixture.componentInstance as TestableCourierProductFormDialog;

    component.form.get('courierModeId')!.setValue('mode-pt');
    component.form.get('courierVendorId')!.setValue('vendor-ip');
    expect(component.form.get('serviceType')?.value).toBe('BOTH');

    component.form.get('courierVendorId')!.setValue('');
    expect(component.form.get('serviceType')?.value).toBe('');
    expect(component.form.get('serviceType')?.disabled).toBe(true);
  });

  it('only offers active Product Groups', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    flushOptions();
    const component = fixture.componentInstance as TestableCourierProductFormDialog;

    expect(component.productGroupOptions().map((o) => o.value)).toEqual(['grp-dp']);
  });

  it('does not submit when required fields are empty', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    flushOptions();
    const component = fixture.componentInstance as TestableCourierProductFormDialog;

    component.onSubmit();

    expect(dialogRefCloseSpy).not.toHaveBeenCalled();
    httpMock.expectNone(apiUrl('master/courierproduct/add'));
  });

  it('rejects a decimal Volumetric Divisor before it reaches the backend', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    flushOptions();
    const component = fixture.componentInstance as TestableCourierProductFormDialog;

    component.form.get('volumetricDivisor')!.setValue('5000.5');
    expect(component.form.get('volumetricDivisor')!.invalid).toBe(true);
  });

  it('rejects a negative Volumetric Divisor', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    flushOptions();
    const component = fixture.componentInstance as TestableCourierProductFormDialog;

    component.form.get('volumetricDivisor')!.setValue('-100');
    expect(component.form.get('volumetricDivisor')!.invalid).toBe(true);
  });

  it('accepts 0 as a valid Volumetric Divisor — CONFIRMED LIVE zero is real data, not an invalid value', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    flushOptions();
    const component = fixture.componentInstance as TestableCourierProductFormDialog;

    component.form.get('volumetricDivisor')!.setValue('0');
    expect(component.form.get('volumetricDivisor')!.invalid).toBe(false);
  });

  it('submits a whole-number Volumetric Divisor and the full dependency chain to the real add endpoint', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    flushOptions();
    const component = fixture.componentInstance as TestableCourierProductFormDialog;

    component.form.patchValue({ code: 'DP', name: 'Domestic Priority', courierModeId: 'mode-cr', courierProductGroupId: 'grp-dp', volumetricDivisor: '5000' });
    component.form.get('courierVendorId')!.setValue('vendor-bd');

    component.onSubmit();

    const req = httpMock.expectOne(apiUrl('master/courierproduct/add'));
    expect(req.request.body.courierVendorId).toBe('vendor-bd');
    expect(req.request.body.serviceType).toBe('DOMESTIC');
    expect(req.request.body.volumetricDivisor).toBe(5000);
    req.flush({ success: true, data: null });

    expect(dialogRefCloseSpy).toHaveBeenCalledWith(true);
  });

  it('restores the saved row on Edit, including the derived Service Type', () => {
    const existingRow: CourierProductRow = {
      courierProductId: 'p1',
      code: 'DP',
      name: 'Domestic Priority',
      courierModeId: 'mode-cr',
      courierVendorId: 'vendor-bd',
      courierProductGroupId: 'grp-dp',
      serviceType: 'DOMESTIC',
      volumetricDivisor: 5000,
      isActive: true,
    };
    const fixture = createComponent({ row: existingRow, mode: 'edit' });
    flushOptions();
    const component = fixture.componentInstance as TestableCourierProductFormDialog;

    expect(component.form.get('courierVendorId')?.value).toBe('vendor-bd');
    expect(component.form.get('courierVendorId')?.disabled).toBe(false);
    expect(component.form.get('serviceType')?.value).toBe('DOMESTIC');
    expect(component.form.get('volumetricDivisor')?.value).toBe('5000');

    component.onSubmit();

    const req = httpMock.expectOne(apiUrl('master/courierproduct/edit'));
    expect(req.request.body.courierProductId).toBe('p1');
    req.flush({ success: true, data: null });

    expect(dialogRefCloseSpy).toHaveBeenCalledWith(true);
  });

  it('surfaces the real backend rejection message verbatim', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    flushOptions();
    const component = fixture.componentInstance as TestableCourierProductFormDialog;

    component.form.patchValue({ code: 'DP', name: 'Domestic Priority', courierModeId: 'mode-cr', courierProductGroupId: 'grp-dp', volumetricDivisor: '5000' });
    component.form.get('courierVendorId')!.setValue('vendor-bd');
    component.onSubmit();

    const req = httpMock.expectOne(apiUrl('master/courierproduct/add'));
    req.flush({ success: false, message: 'Duplicate product code already exists.', data: null });

    expect(component.errorMessage()).toBe('Duplicate product code already exists.');
    expect(dialogRefCloseSpy).not.toHaveBeenCalled();
  });

  it('Remarks always starts blank, even when editing an existing row', () => {
    const existingRow: CourierProductRow = { courierProductId: 'p1', code: 'DP', name: 'Domestic Priority', courierModeId: 'mode-cr', courierVendorId: 'vendor-bd', courierProductGroupId: 'grp-dp', serviceType: 'DOMESTIC', volumetricDivisor: 5000, isActive: true };
    const fixture = createComponent({ row: existingRow, mode: 'edit' });
    flushOptions();
    const component = fixture.componentInstance as TestableCourierProductFormDialog;

    expect(component.form.get('remarks')?.value).toBe('');
  });
});
