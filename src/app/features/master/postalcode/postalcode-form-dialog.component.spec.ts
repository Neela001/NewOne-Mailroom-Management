import { TestBed } from '@angular/core/testing';
import { DIALOG_DATA } from '../../../shared/ui/dialog/dialog-data.token';
import { DialogRef } from '../../../shared/ui/dialog/dialog-ref';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { FormGroup } from '@angular/forms';
import { PostalCodeFormDialogComponent, PostalCodeFormDialogData } from './postalcode-form-dialog.component';
import { ConfigService } from '../../../core/services/config.service';
import { PostalCodeRow } from './postalcode.model';
import { SelectOption } from '../../../shared/ui/form/select.component';
import { provideAppIcons } from '../../../shared/ui/icon/lucide-icons.provider';

type TestablePostalCodeFormDialog = PostalCodeFormDialogComponent & {
  form: FormGroup;
  countryOptions: () => SelectOption[];
  stateOptions: () => SelectOption[];
  cityOptions: () => SelectOption[];
};

const COUNTRY_ROWS = [
  { CountryId: 'c-india', CountryCode: 'IN', CountryName: 'India', HasState: true, HasPostalCode: true, IsActive: true },
  { CountryId: 'c-no-pc', CountryCode: 'ZZ', CountryName: 'No Postal Country', HasState: true, HasPostalCode: false, IsActive: true },
];

const STATE_ROWS = [
  { StateId: 's-tn', CountryId: 'c-india', StateCode: 'TN', StateName: 'Tamil Nadu', IsActive: true },
  { StateId: 's-mh', CountryId: 'c-india', StateCode: 'MH', StateName: 'Maharashtra', IsActive: true },
];

const CITY_ROWS = [
  { CityId: 'ct-chn', CountryId: 'c-india', StateId: 's-tn', CityCode: 'CHN', CityName: 'Chennai', IsActive: true },
  { CityId: 'ct-mum', CountryId: 'c-india', StateId: 's-mh', CityCode: 'MUM', CityName: 'Mumbai', IsActive: true },
];

// Covers the 3-level Country -> State -> City dependency logic this task
// calls out as critical: the Country dropdown filtered to active,
// Postal-Code-enabled countries; State and City both genuinely optional
// and independently cascading (client-side, since neither
// StateGetRequest nor CityGetRequest has a real countryId/stateId filter
// param — confirmed live); City further narrowed by State when one is
// selected; Country change resetting both State and City, State change
// resetting City only; and never sending a fabricated stateId/cityId.
describe('PostalCodeFormDialogComponent', () => {
  let httpMock: HttpTestingController;
  let dialogRefCloseSpy: ReturnType<typeof vi.fn>;

  function apiUrl(path: string): string {
    return `${TestBed.inject(ConfigService).getApiUrl()}${path}`;
  }

  function createComponent(data: PostalCodeFormDialogData) {
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
    const fixture = TestBed.createComponent(PostalCodeFormDialogComponent);
    fixture.detectChanges();
    return fixture;
  }

  function flushLookups(countries: Record<string, unknown>[] = COUNTRY_ROWS, states: Record<string, unknown>[] = STATE_ROWS, cities: Record<string, unknown>[] = CITY_ROWS) {
    httpMock.expectOne(apiUrl('master/country/get')).flush({ success: true, data: countries });
    httpMock.expectOne(apiUrl('master/state/get')).flush({ success: true, data: states });
    httpMock.expectOne(apiUrl('master/city/get')).flush({ success: true, data: cities });
  }

  afterEach(() => httpMock.verify());

  it('only offers active, Postal-Code-enabled countries', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    flushLookups();
    const component = fixture.componentInstance as TestablePostalCodeFormDialog;

    expect(component.countryOptions().map((o) => o.label)).toEqual(['India (IN)']);
  });

  it('keeps State and City disabled and empty before a Country is selected', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    flushLookups();
    const component = fixture.componentInstance as TestablePostalCodeFormDialog;

    expect(component.stateOptions()).toEqual([]);
    expect(component.cityOptions()).toEqual([]);
    expect(component.form.get('stateId')?.disabled).toBe(true);
    expect(component.form.get('cityId')?.disabled).toBe(true);
  });

  it('enables State/City and loads the selected Country\'s own options once a Country is chosen', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    flushLookups();
    const component = fixture.componentInstance as TestablePostalCodeFormDialog;

    component.form.get('countryId')!.setValue('c-india');

    expect(component.form.get('stateId')?.disabled).toBe(false);
    expect(component.form.get('cityId')?.disabled).toBe(false);
    expect(component.stateOptions().map((o) => o.label)).toEqual(['Tamil Nadu (TN)', 'Maharashtra (MH)']);
    // Before a State is chosen, City shows every eligible city for the
    // whole Country (both Chennai and Mumbai).
    expect(component.cityOptions().map((o) => o.label)).toEqual(['Chennai (CHN)', 'Mumbai (MUM)']);
  });

  it('narrows City to the selected State once one is chosen', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    flushLookups();
    const component = fixture.componentInstance as TestablePostalCodeFormDialog;

    component.form.get('countryId')!.setValue('c-india');
    component.form.get('stateId')!.setValue('s-tn');

    expect(component.cityOptions().map((o) => o.label)).toEqual(['Chennai (CHN)']);
  });

  it('clears State and City when the Country changes', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    flushLookups();
    const component = fixture.componentInstance as TestablePostalCodeFormDialog;

    component.form.get('countryId')!.setValue('c-india');
    component.form.patchValue({ stateId: 's-tn', cityId: 'ct-chn' });
    expect(component.form.get('stateId')?.value).toBe('s-tn');
    expect(component.form.get('cityId')?.value).toBe('ct-chn');

    component.form.get('countryId')!.setValue('');
    expect(component.form.get('stateId')?.value).toBe('');
    expect(component.form.get('cityId')?.value).toBe('');
  });

  it('clears only City (not Country or State) when the State changes', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    flushLookups();
    const component = fixture.componentInstance as TestablePostalCodeFormDialog;

    component.form.get('countryId')!.setValue('c-india');
    component.form.patchValue({ stateId: 's-tn', cityId: 'ct-chn' });
    expect(component.form.get('cityId')?.value).toBe('ct-chn');

    component.form.get('stateId')!.setValue('s-mh');
    expect(component.form.get('cityId')?.value).toBe('');
    expect(component.form.get('countryId')?.value).toBe('c-india');
  });

  it('does not submit when Country/Postal Code are empty', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    flushLookups();
    const component = fixture.componentInstance as TestablePostalCodeFormDialog;

    component.onSubmit();

    expect(dialogRefCloseSpy).not.toHaveBeenCalled();
    httpMock.expectNone(apiUrl('master/postalcode/add'));
  });

  it('submits to master/postalcode/add with Country + Postal Code only (no State/City)', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    flushLookups();
    const component = fixture.componentInstance as TestablePostalCodeFormDialog;

    component.form.get('countryId')!.setValue('c-india');
    component.form.patchValue({ postalCode: '600001' });
    component.onSubmit();

    const req = httpMock.expectOne(apiUrl('master/postalcode/add'));
    expect(req.request.body.postalCodeId).toBeNull();
    expect(req.request.body.countryId).toBe('c-india');
    expect(req.request.body.stateId).toBeNull();
    expect(req.request.body.cityId).toBeNull();
    expect(req.request.body.postalCode).toBe('600001');
    req.flush({ success: true, data: null });

    expect(dialogRefCloseSpy).toHaveBeenCalledWith(true);
  });

  it('preserves a leading-zero postal code exactly as typed', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    flushLookups();
    const component = fixture.componentInstance as TestablePostalCodeFormDialog;

    component.form.get('countryId')!.setValue('c-india');
    component.form.patchValue({ postalCode: '007001' });
    component.onSubmit();

    const req = httpMock.expectOne(apiUrl('master/postalcode/add'));
    expect(req.request.body.postalCode).toBe('007001');
    req.flush({ success: true, data: null });
  });

  it('submits with Country + State + City + Postal Code all set', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    flushLookups();
    const component = fixture.componentInstance as TestablePostalCodeFormDialog;

    component.form.get('countryId')!.setValue('c-india');
    component.form.get('stateId')!.setValue('s-tn');
    component.form.patchValue({ cityId: 'ct-chn', postalCode: '600001' });
    component.onSubmit();

    const req = httpMock.expectOne(apiUrl('master/postalcode/add'));
    expect(req.request.body.stateId).toBe('s-tn');
    expect(req.request.body.cityId).toBe('ct-chn');
    req.flush({ success: true, data: null });
  });

  it('submits to master/postalcode/edit with the existing postalCodeId and restores the saved relationship', () => {
    const existingRow: PostalCodeRow = { postalCodeId: 'pc1', countryId: 'c-india', stateId: 's-tn', cityId: 'ct-chn', postalCode: '600001', isActive: true };
    const fixture = createComponent({ row: existingRow, mode: 'edit' });
    flushLookups();
    const component = fixture.componentInstance as TestablePostalCodeFormDialog;

    expect(component.form.get('countryId')?.value).toBe('c-india');
    expect(component.form.get('stateId')?.value).toBe('s-tn');
    expect(component.form.get('cityId')?.value).toBe('ct-chn');

    component.onSubmit();

    const req = httpMock.expectOne(apiUrl('master/postalcode/edit'));
    expect(req.request.body.postalCodeId).toBe('pc1');
    expect(req.request.body.stateId).toBe('s-tn');
    expect(req.request.body.cityId).toBe('ct-chn');
    req.flush({ success: true, data: null });

    expect(dialogRefCloseSpy).toHaveBeenCalledWith(true);
  });
});
