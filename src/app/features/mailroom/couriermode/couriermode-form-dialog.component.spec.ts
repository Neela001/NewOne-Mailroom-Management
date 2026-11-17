import { TestBed } from '@angular/core/testing';
import { DIALOG_DATA } from '../../../shared/ui/dialog/dialog-data.token';
import { DialogRef } from '../../../shared/ui/dialog/dialog-ref';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { FormGroup } from '@angular/forms';
import { CourierModeFormDialogComponent, CourierModeFormDialogData } from './couriermode-form-dialog.component';
import { ConfigService } from '../../../core/services/config.service';
import { CourierModeRow } from './couriermode.model';
import { provideAppIcons } from '../../../shared/ui/icon/lucide-icons.provider';

type TestableCourierModeFormDialog = CourierModeFormDialogComponent & {
  form: FormGroup;
  errorMessage: () => string | null;
};

// Covers required-field validation, trim-on-submit, the real confirmed-
// live backend duplicate-mode-code rejection, and the Edit flow
// restoring the saved row and echoing the existing courierModeId back on
// update. No dependency/cascade to cover — Courier Mode is a standalone
// entity with no parent relationship at all.
describe('CourierModeFormDialogComponent', () => {
  let httpMock: HttpTestingController;
  let dialogRefCloseSpy: ReturnType<typeof vi.fn>;

  function apiUrl(path: string): string {
    return `${TestBed.inject(ConfigService).getApiUrl()}${path}`;
  }

  function createComponent(data: CourierModeFormDialogData) {
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
    const fixture = TestBed.createComponent(CourierModeFormDialogComponent);
    fixture.detectChanges();
    return fixture;
  }

  afterEach(() => httpMock.verify());

  it('does not submit when Mode Code/Mode Name are empty', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    const component = fixture.componentInstance as TestableCourierModeFormDialog;

    component.onSubmit();

    expect(dialogRefCloseSpy).not.toHaveBeenCalled();
    httpMock.expectNone(apiUrl('master/couriermode/add'));
  });

  it('trims leading/trailing spaces from Mode Code and Mode Name on submit', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    const component = fixture.componentInstance as TestableCourierModeFormDialog;

    component.form.patchValue({ modeCode: '  CR-02  ', modeName: '  Express Courier  ' });
    component.onSubmit();

    const req = httpMock.expectOne(apiUrl('master/couriermode/add'));
    expect(req.request.body.modeCode).toBe('CR-02');
    expect(req.request.body.modeName).toBe('Express Courier');
    req.flush({ success: true, data: null });

    expect(dialogRefCloseSpy).toHaveBeenCalledWith(true);
  });

  it('submits null courierModeId on Add', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    const component = fixture.componentInstance as TestableCourierModeFormDialog;

    component.form.patchValue({ modeCode: 'CR-02', modeName: 'Express Courier' });
    component.onSubmit();

    const req = httpMock.expectOne(apiUrl('master/couriermode/add'));
    expect(req.request.body.courierModeId).toBeNull();
    req.flush({ success: true, data: null });
  });

  it('surfaces the real backend duplicate-mode-code rejection message', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    const component = fixture.componentInstance as TestableCourierModeFormDialog;

    component.form.patchValue({ modeCode: 'CR', modeName: 'Courier' });
    component.onSubmit();

    const req = httpMock.expectOne(apiUrl('master/couriermode/add'));
    req.flush({ success: false, message: 'Duplicate mode code already exists.', data: null });

    expect(component.errorMessage()).toBe('Duplicate mode code already exists.');
    expect(dialogRefCloseSpy).not.toHaveBeenCalled();
  });

  it('restores the saved row on Edit and submits to master/couriermode/edit with the existing courierModeId', () => {
    const existingRow: CourierModeRow = { courierModeId: 'cm1', modeCode: 'CR', modeName: 'Courier', isActive: true };
    const fixture = createComponent({ row: existingRow, mode: 'edit' });
    const component = fixture.componentInstance as TestableCourierModeFormDialog;

    expect(component.form.get('modeCode')?.value).toBe('CR');
    expect(component.form.get('modeName')?.value).toBe('Courier');

    component.onSubmit();

    const req = httpMock.expectOne(apiUrl('master/couriermode/edit'));
    expect(req.request.body.courierModeId).toBe('cm1');
    req.flush({ success: true, data: null });

    expect(dialogRefCloseSpy).toHaveBeenCalledWith(true);
  });

  it('includes Change Remarks in the submit payload when provided', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    const component = fixture.componentInstance as TestableCourierModeFormDialog;

    component.form.patchValue({ modeCode: 'CR-02', modeName: 'Express Courier', remarks: 'New mode for express deliveries' });
    component.onSubmit();

    const req = httpMock.expectOne(apiUrl('master/couriermode/add'));
    expect(req.request.body.remarks).toBe('New mode for express deliveries');
    req.flush({ success: true, data: null });
  });

  it('Remarks always starts blank, even when editing an existing row', () => {
    const existingRow: CourierModeRow = { courierModeId: 'cm1', modeCode: 'CR', modeName: 'Courier', isActive: true };
    const fixture = createComponent({ row: existingRow, mode: 'edit' });
    const component = fixture.componentInstance as TestableCourierModeFormDialog;

    expect(component.form.get('remarks')?.value).toBe('');
  });
});
