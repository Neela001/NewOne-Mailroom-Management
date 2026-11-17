import { TestBed } from '@angular/core/testing';
import { DIALOG_DATA } from '../../../shared/ui/dialog/dialog-data.token';
import { DialogRef } from '../../../shared/ui/dialog/dialog-ref';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { FormGroup } from '@angular/forms';
import { CityFormDialogComponent, CityFormDialogData } from './city-form-dialog.component';
import { ConfigService } from '../../../core/services/config.service';
import { CityRow } from './city.model';
import { SelectOption } from '../../../shared/ui/form/select.component';
import { provideAppIcons } from '../../../shared/ui/icon/lucide-icons.provider';

type TestableCityFormDialog = CityFormDialogComponent & {
  form: FormGroup;
  countryOptions: () => SelectOption[];
  stateOptions: () => SelectOption[];
  stateApplicable: () => boolean;
  stateLabel: () => string;
};

const COUNTRY_ROWS = [
  { CountryId: 'c-india', CountryCode: 'IN', CountryName: 'India', HasState: true, HasCity: true, IsActive: true },
  { CountryId: 'c-afg', CountryCode: 'AFG', CountryName: 'Afghanistan', HasState: false, HasCity: true, IsActive: true },
  { CountryId: 'c-no-city', CountryCode: 'ZZ', CountryName: 'No City Country', HasState: true, HasCity: false, IsActive: true },
];

const STATE_ROWS = [
  { StateId: 's-tn', CountryId: 'c-india', StateCode: 'TN', StateName: 'Tamil Nadu', IsActive: true },
  { StateId: 's-mh', CountryId: 'c-india', StateCode: 'MH', StateName: 'Maharashtra', IsActive: true },
  { StateId: 's-other', CountryId: 'c-other', StateCode: 'XX', StateName: 'Other Country State', IsActive: true },
];

// Covers the Country -> State dependency logic this task calls out as "the
// most important part": the Country dropdown filtered to active,
// City-enabled countries; the State dropdown client-side filtered to the
// selected Country (CONFIRMED LIVE StateGetRequest has no countryId filter
// param — see city-form-dialog.component.ts's own comment); disabled +
// relabeled "State (Not applicable)" for a Country with no State support;
// clearing State on Country change; and never sending a fabricated
// stateId.
describe('CityFormDialogComponent', () => {
  let httpMock: HttpTestingController;
  let dialogRefCloseSpy: ReturnType<typeof vi.fn>;

  function apiUrl(path: string): string {
    return `${TestBed.inject(ConfigService).getApiUrl()}${path}`;
  }

  function createComponent(data: CityFormDialogData) {
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
    const fixture = TestBed.createComponent(CityFormDialogComponent);
    fixture.detectChanges();
    return fixture;
  }

  function flushLookups(countries: Record<string, unknown>[] = COUNTRY_ROWS, states: Record<string, unknown>[] = STATE_ROWS) {
    httpMock.expectOne(apiUrl('master/country/get')).flush({ success: true, data: countries });
    httpMock.expectOne(apiUrl('master/state/get')).flush({ success: true, data: states });
  }

  afterEach(() => httpMock.verify());

  it('only offers active, City-enabled countries', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    flushLookups();
    const component = fixture.componentInstance as TestableCityFormDialog;

    const labels = component.countryOptions().map((o) => o.label);
    expect(labels).toEqual(['India (IN)', 'Afghanistan (AFG)']);
  });

  it('keeps the State field disabled and empty before a Country is selected', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    flushLookups();
    const component = fixture.componentInstance as TestableCityFormDialog;

    expect(component.stateOptions()).toEqual([]);
    expect(component.form.get('stateId')?.disabled).toBe(true);
  });

  it('loads only the selected Country\'s own active states once a Country with Has State is chosen', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    flushLookups();
    const component = fixture.componentInstance as TestableCityFormDialog;

    component.form.get('countryId')!.setValue('c-india');

    const labels = component.stateOptions().map((o) => o.label);
    expect(labels).toEqual(['Tamil Nadu (TN)', 'Maharashtra (MH)']);
    expect(component.form.get('stateId')?.disabled).toBe(false);
    expect(component.stateLabel()).toBe('State');
  });

  it('disables and relabels State to "(Not applicable)" for a Country with Has State = false', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    flushLookups();
    const component = fixture.componentInstance as TestableCityFormDialog;

    component.form.get('countryId')!.setValue('c-afg');

    expect(component.stateApplicable()).toBe(false);
    expect(component.stateLabel()).toBe('State (Not applicable)');
    expect(component.form.get('stateId')?.disabled).toBe(true);
  });

  it('clears the selected State when the Country changes', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    flushLookups();
    const component = fixture.componentInstance as TestableCityFormDialog;

    component.form.get('countryId')!.setValue('c-india');
    component.form.get('stateId')!.setValue('s-tn');
    expect(component.form.get('stateId')?.value).toBe('s-tn');

    component.form.get('countryId')!.setValue('c-afg');
    expect(component.form.get('stateId')?.value).toBe('');
  });

  it('does not submit when Country/City Name are empty', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    flushLookups();
    const component = fixture.componentInstance as TestableCityFormDialog;

    component.onSubmit();

    expect(dialogRefCloseSpy).not.toHaveBeenCalled();
    httpMock.expectNone(apiUrl('master/city/add'));
  });

  it('submits to master/city/add with the real stateId for a State-enabled country', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    flushLookups();
    const component = fixture.componentInstance as TestableCityFormDialog;

    component.form.get('countryId')!.setValue('c-india');
    component.form.patchValue({ stateId: 's-tn', cityCode: 'CHN', cityName: 'Chennai' });
    component.onSubmit();

    const req = httpMock.expectOne(apiUrl('master/city/add'));
    expect(req.request.body.cityId).toBeNull();
    expect(req.request.body.countryId).toBe('c-india');
    expect(req.request.body.stateId).toBe('s-tn');
    expect(req.request.body.cityName).toBe('Chennai');
    req.flush({ success: true, data: null });

    expect(dialogRefCloseSpy).toHaveBeenCalledWith(true);
  });

  it('never sends a fabricated stateId for a Country without State support', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    flushLookups();
    const component = fixture.componentInstance as TestableCityFormDialog;

    component.form.get('countryId')!.setValue('c-afg');
    component.form.patchValue({ cityName: 'Kabul' });
    component.onSubmit();

    const req = httpMock.expectOne(apiUrl('master/city/add'));
    expect(req.request.body.stateId).toBeNull();
    req.flush({ success: true, data: null });
  });

  it('submits to master/city/edit with the existing cityId and restores the saved Country/State relationship', () => {
    const existingRow: CityRow = { cityId: 'ct1', countryId: 'c-india', stateId: 's-tn', cityCode: 'CHN', cityName: 'Chennai', isActive: true };
    const fixture = createComponent({ row: existingRow, mode: 'edit' });
    flushLookups();
    const component = fixture.componentInstance as TestableCityFormDialog;

    expect(component.form.get('countryId')?.value).toBe('c-india');
    expect(component.form.get('stateId')?.value).toBe('s-tn');
    expect(component.stateApplicable()).toBe(true);

    component.onSubmit();

    const req = httpMock.expectOne(apiUrl('master/city/edit'));
    expect(req.request.body.cityId).toBe('ct1');
    expect(req.request.body.stateId).toBe('s-tn');
    req.flush({ success: true, data: null });

    expect(dialogRefCloseSpy).toHaveBeenCalledWith(true);
  });
});
