import { TestBed } from '@angular/core/testing';
import { DIALOG_DATA } from '../../../shared/ui/dialog/dialog-data.token';
import { DialogRef } from '../../../shared/ui/dialog/dialog-ref';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { FormGroup } from '@angular/forms';
import { CountryFormDialogComponent, CountryFormDialogData } from './country-form-dialog.component';
import { ConfigService } from '../../../core/services/config.service';
import { CountryRow } from './country.model';
import { provideAppIcons } from '../../../shared/ui/icon/lucide-icons.provider';

type TestableCountryFormDialog = CountryFormDialogComponent & { form: FormGroup; errorMessage: () => string | null };

// Covers required-field validation (Country Code/Country Name), the real
// master/country/add vs /edit split, the four independent Available Levels
// checkboxes saving as real boolean properties, and that Remarks always
// starts blank (CONFIRMED LIVE: a write-only-per-action changelog note, not
// persistent row state — see country.model.ts's own comment) even when
// editing a row whose own history has a real saved remarks value.
describe('CountryFormDialogComponent', () => {
  let httpMock: HttpTestingController;
  let dialogRefCloseSpy: ReturnType<typeof vi.fn>;

  function apiUrl(path: string): string {
    return `${TestBed.inject(ConfigService).getApiUrl()}${path}`;
  }

  function createComponent(data: CountryFormDialogData) {
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
    const fixture = TestBed.createComponent(CountryFormDialogComponent);
    fixture.detectChanges();
    return fixture;
  }

  afterEach(() => httpMock.verify());

  it('does not submit when Country Code/Country Name are empty', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    const component = fixture.componentInstance as TestableCountryFormDialog;

    component.onSubmit();

    expect(dialogRefCloseSpy).not.toHaveBeenCalled();
    httpMock.expectNone(apiUrl('master/country/add'));
    expect(component.form.get('countryCode')?.touched).toBe(true);
    expect(component.form.get('countryName')?.touched).toBe(true);
  });

  it('submits to master/country/add with no countryId and the four Available Levels booleans when adding', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    const component = fixture.componentInstance as TestableCountryFormDialog;

    component.form.patchValue({
      countryCode: 'IN',
      countryName: 'India',
      isdCode: '+91',
      hasState: true,
      hasCity: true,
      hasPostalCode: true,
      hasArea: false,
      stateLabel: 'State',
      postalCodeLabel: 'Pincode',
    });
    component.onSubmit();

    const req = httpMock.expectOne(apiUrl('master/country/add'));
    expect(req.request.body.countryId).toBeNull();
    expect(req.request.body.countryCode).toBe('IN');
    expect(req.request.body.countryName).toBe('India');
    expect(req.request.body.hasState).toBe(true);
    expect(req.request.body.hasCity).toBe(true);
    expect(req.request.body.hasPostalCode).toBe(true);
    expect(req.request.body.hasArea).toBe(false);
    expect(req.request.body.stateLabel).toBe('State');
    expect(req.request.body.postalCodeLabel).toBe('Pincode');
    req.flush({ success: true, data: null });

    expect(dialogRefCloseSpy).toHaveBeenCalledWith(true);
  });

  it('submits to master/country/edit with the existing countryId when editing, and loads existing checkbox/label values', () => {
    const existingRow: CountryRow = {
      countryId: 'c1',
      countryCode: 'IN',
      countryName: 'India',
      isdCode: '+91',
      hasState: true,
      hasCity: true,
      hasPostalCode: true,
      hasArea: true,
      stateLabel: 'State',
      postalCodeLabel: 'Pincode',
      isActive: true,
    };
    const fixture = createComponent({ row: existingRow, mode: 'edit' });
    const component = fixture.componentInstance as TestableCountryFormDialog;

    // Edit mode: previously saved values must remain unchanged until the
    // user edits them.
    expect(component.form.get('countryCode')?.value).toBe('IN');
    expect(component.form.get('hasState')?.value).toBe(true);
    expect(component.form.get('hasCity')?.value).toBe(true);
    expect(component.form.get('hasPostalCode')?.value).toBe(true);
    expect(component.form.get('hasArea')?.value).toBe(true);
    expect(component.form.get('stateLabel')?.value).toBe('State');
    expect(component.form.get('postalCodeLabel')?.value).toBe('Pincode');
    // Remarks always starts blank on Edit — see this spec's own top comment.
    expect(component.form.get('remarks')?.value).toBe('');

    component.form.patchValue({ hasArea: false });
    component.onSubmit();

    const req = httpMock.expectOne(apiUrl('master/country/edit'));
    expect(req.request.body.countryId).toBe('c1');
    expect(req.request.body.hasArea).toBe(false);
    expect(req.request.body.hasState).toBe(true);
    req.flush({ success: true, data: null });

    expect(dialogRefCloseSpy).toHaveBeenCalledWith(true);
  });

  it('surfaces a failed save response as an inline error without closing the dialog', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    const component = fixture.componentInstance as TestableCountryFormDialog;

    component.form.patchValue({ countryCode: 'ZZ', countryName: 'Test' });
    component.onSubmit();

    const req = httpMock.expectOne(apiUrl('master/country/add'));
    req.flush({ success: false, message: 'Country code already exists.' });

    expect(dialogRefCloseSpy).not.toHaveBeenCalled();
    expect(component.errorMessage()).toContain('already exists');
  });
});
