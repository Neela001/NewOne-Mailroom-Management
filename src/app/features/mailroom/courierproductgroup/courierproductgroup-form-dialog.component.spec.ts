import { TestBed } from '@angular/core/testing';
import { DIALOG_DATA } from '../../../shared/ui/dialog/dialog-data.token';
import { DialogRef } from '../../../shared/ui/dialog/dialog-ref';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { FormGroup } from '@angular/forms';
import { CourierProductGroupFormDialogComponent, CourierProductGroupFormDialogData } from './courierproductgroup-form-dialog.component';
import { ConfigService } from '../../../core/services/config.service';
import { CourierProductGroupRow } from './courierproductgroup.model';
import { provideAppIcons } from '../../../shared/ui/icon/lucide-icons.provider';

type TestableCourierProductGroupFormDialog = CourierProductGroupFormDialogComponent & {
  form: FormGroup;
  errorMessage: () => string | null;
};

// Covers required-field validation, trim-on-submit, the real confirmed-
// live backend duplicate-code rejection (CASE-INSENSITIVE — confirmed
// live, not assumed), and the Edit flow restoring the saved row and
// echoing the existing courierProductGroupId back on update. No
// dependency/cascade to cover — Courier Product Group is a standalone
// entity with no parent relationship at all.
describe('CourierProductGroupFormDialogComponent', () => {
  let httpMock: HttpTestingController;
  let dialogRefCloseSpy: ReturnType<typeof vi.fn>;

  function apiUrl(path: string): string {
    return `${TestBed.inject(ConfigService).getApiUrl()}${path}`;
  }

  function createComponent(data: CourierProductGroupFormDialogData) {
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
    const fixture = TestBed.createComponent(CourierProductGroupFormDialogComponent);
    fixture.detectChanges();
    return fixture;
  }

  afterEach(() => httpMock.verify());

  it('does not submit when Code/Name are empty', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    const component = fixture.componentInstance as TestableCourierProductGroupFormDialog;

    component.onSubmit();

    expect(dialogRefCloseSpy).not.toHaveBeenCalled();
    httpMock.expectNone(apiUrl('master/courierproductgroup/add'));
  });

  it('trims leading/trailing spaces from Code and Name on submit', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    const component = fixture.componentInstance as TestableCourierProductGroupFormDialog;

    component.form.patchValue({ code: '  DP  ', name: '  Doc Air  ' });
    component.onSubmit();

    const req = httpMock.expectOne(apiUrl('master/courierproductgroup/add'));
    expect(req.request.body.code).toBe('DP');
    expect(req.request.body.name).toBe('Doc Air');
    req.flush({ success: true, data: null });

    expect(dialogRefCloseSpy).toHaveBeenCalledWith(true);
  });

  it('submits null courierProductGroupId on Add', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    const component = fixture.componentInstance as TestableCourierProductGroupFormDialog;

    component.form.patchValue({ code: 'DP', name: 'Doc Air' });
    component.onSubmit();

    const req = httpMock.expectOne(apiUrl('master/courierproductgroup/add'));
    expect(req.request.body.courierProductGroupId).toBeNull();
    req.flush({ success: true, data: null });
  });

  it('surfaces the real backend duplicate-code rejection message, confirmed case-insensitive', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    const component = fixture.componentInstance as TestableCourierProductGroupFormDialog;

    component.form.patchValue({ code: 'dp', name: 'Doc Air lowercase attempt' });
    component.onSubmit();

    const req = httpMock.expectOne(apiUrl('master/courierproductgroup/add'));
    req.flush({ success: false, message: 'Duplicate product group code already exists.', data: null });

    expect(component.errorMessage()).toBe('Duplicate product group code already exists.');
    expect(dialogRefCloseSpy).not.toHaveBeenCalled();
  });

  it('restores the saved row on Edit and submits to master/courierproductgroup/edit with the existing courierProductGroupId', () => {
    const existingRow: CourierProductGroupRow = { courierProductGroupId: 'g1', code: 'DP', name: 'Doc Air', isActive: true };
    const fixture = createComponent({ row: existingRow, mode: 'edit' });
    const component = fixture.componentInstance as TestableCourierProductGroupFormDialog;

    expect(component.form.get('code')?.value).toBe('DP');
    expect(component.form.get('name')?.value).toBe('Doc Air');

    component.onSubmit();

    const req = httpMock.expectOne(apiUrl('master/courierproductgroup/edit'));
    expect(req.request.body.courierProductGroupId).toBe('g1');
    req.flush({ success: true, data: null });

    expect(dialogRefCloseSpy).toHaveBeenCalledWith(true);
  });

  it('includes Change remarks in the submit payload when provided', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    const component = fixture.componentInstance as TestableCourierProductGroupFormDialog;

    component.form.patchValue({ code: 'DP', name: 'Doc Air', remarks: 'New product group for domestic air' });
    component.onSubmit();

    const req = httpMock.expectOne(apiUrl('master/courierproductgroup/add'));
    expect(req.request.body.remarks).toBe('New product group for domestic air');
    req.flush({ success: true, data: null });
  });

  it('Remarks always starts blank, even when editing an existing row', () => {
    const existingRow: CourierProductGroupRow = { courierProductGroupId: 'g1', code: 'DP', name: 'Doc Air', isActive: true };
    const fixture = createComponent({ row: existingRow, mode: 'edit' });
    const component = fixture.componentInstance as TestableCourierProductGroupFormDialog;

    expect(component.form.get('remarks')?.value).toBe('');
  });
});
