import { TestBed } from '@angular/core/testing';
import { DIALOG_DATA } from '../../../shared/ui/dialog/dialog-data.token';
import { DialogRef } from '../../../shared/ui/dialog/dialog-ref';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { FormGroup } from '@angular/forms';
import { AreaFormDialogComponent, AreaFormDialogData } from './area-form-dialog.component';
import { ConfigService } from '../../../core/services/config.service';
import { AreaRow } from './area.model';
import { SelectOption } from '../../../shared/ui/form/select.component';
import { provideAppIcons } from '../../../shared/ui/icon/lucide-icons.provider';

type TestableAreaFormDialog = AreaFormDialogComponent & {
  form: FormGroup;
  countryOptions: () => SelectOption[];
  stateOptions: () => SelectOption[];
  cityOptions: () => SelectOption[];
  postalCodeOptions: () => SelectOption[];
  stateLabel: () => string;
  cityLabel: () => string;
  postalCodeLabel: () => string;
};

// India supports all four levels. Afghanistan deliberately mixes flags
// (hasState=false, hasCity=true, hasPostalCode=false) — the same real,
// confirmed-live combination this task's own investigation found, used
// here to prove each dependent level is gated by its OWN capability flag
// independently, never chained to another level's own applicability.
const COUNTRY_ROWS = [
  { CountryId: 'c-india', CountryCode: 'IN', CountryName: 'India', HasState: true, HasCity: true, HasPostalCode: true, HasArea: true, IsActive: true },
  { CountryId: 'c-afg', CountryCode: 'AFG', CountryName: 'Afghanistan', HasState: false, HasCity: true, HasPostalCode: false, HasArea: true, IsActive: true },
  { CountryId: 'c-no-area', CountryCode: 'ZZ', CountryName: 'No Area Country', HasState: true, HasCity: true, HasPostalCode: true, HasArea: false, IsActive: true },
];

const STATE_ROWS = [
  { StateId: 's-tn', CountryId: 'c-india', StateCode: 'TN', StateName: 'Tamil Nadu', IsActive: true },
  { StateId: 's-mh', CountryId: 'c-india', StateCode: 'MH', StateName: 'Maharashtra', IsActive: true },
];

const CITY_ROWS = [
  { CityId: 'ct-chn', CountryId: 'c-india', StateId: 's-tn', CityCode: 'CHN', CityName: 'Chennai', IsActive: true },
  { CityId: 'ct-mum', CountryId: 'c-india', StateId: 's-mh', CityCode: 'MUM', CityName: 'Mumbai', IsActive: true },
  { CityId: 'ct-kbl', CountryId: 'c-afg', StateId: null, CityCode: 'KBL', CityName: 'Kabul', IsActive: true },
];

const POSTALCODE_ROWS = [
  { PostalCodeId: 'pc-1', CountryId: 'c-india', StateId: 's-tn', CityId: 'ct-chn', PostalCode: '600001', IsActive: true },
  { PostalCodeId: 'pc-2', CountryId: 'c-india', StateId: 's-tn', CityId: 'ct-chn', PostalCode: '600002', IsActive: true },
  { PostalCodeId: 'pc-3', CountryId: 'c-india', StateId: 's-mh', CityId: 'ct-mum', PostalCode: '400001', IsActive: true },
];

// Covers the 4-level Country -> State -> City -> Postal Code dependency
// logic this task calls out as critical: the Country dropdown filtered to
// active, Area-enabled countries; State/City/Postal Code each
// independently gated and dynamically relabeled "(not applicable)" by its
// own real country capability flag (not chained to each other); City
// narrowed by State, Postal Code narrowed by City then State; the full
// reset cascade (Country clears all three, State clears City+Postal Code,
// City clears Postal Code only); and never sending a fabricated
// State/City/PostalCode ID.
describe('AreaFormDialogComponent', () => {
  let httpMock: HttpTestingController;
  let dialogRefCloseSpy: ReturnType<typeof vi.fn>;

  function apiUrl(path: string): string {
    return `${TestBed.inject(ConfigService).getApiUrl()}${path}`;
  }

  function createComponent(data: AreaFormDialogData) {
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
    const fixture = TestBed.createComponent(AreaFormDialogComponent);
    fixture.detectChanges();
    return fixture;
  }

  function flushLookups(
    countries: Record<string, unknown>[] = COUNTRY_ROWS,
    states: Record<string, unknown>[] = STATE_ROWS,
    cities: Record<string, unknown>[] = CITY_ROWS,
    postalCodes: Record<string, unknown>[] = POSTALCODE_ROWS,
  ) {
    httpMock.expectOne(apiUrl('master/country/get')).flush({ success: true, data: countries });
    httpMock.expectOne(apiUrl('master/state/get')).flush({ success: true, data: states });
    httpMock.expectOne(apiUrl('master/city/get')).flush({ success: true, data: cities });
    httpMock.expectOne(apiUrl('master/postalcode/get')).flush({ success: true, data: postalCodes });
  }

  afterEach(() => httpMock.verify());

  it('only offers active, Area-enabled countries', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    flushLookups();
    const component = fixture.componentInstance as TestableAreaFormDialog;

    expect(component.countryOptions().map((o) => o.label)).toEqual(['India (IN)', 'Afghanistan (AFG)']);
  });

  it('keeps State/City/Postal Code disabled and empty before a Country is selected', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    flushLookups();
    const component = fixture.componentInstance as TestableAreaFormDialog;

    expect(component.stateOptions()).toEqual([]);
    expect(component.cityOptions()).toEqual([]);
    expect(component.postalCodeOptions()).toEqual([]);
    expect(component.form.get('stateId')?.disabled).toBe(true);
    expect(component.form.get('cityId')?.disabled).toBe(true);
    expect(component.form.get('postalCodeId')?.disabled).toBe(true);
  });

  it('enables all three dependents and loads their options once a fully-capable Country is chosen', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    flushLookups();
    const component = fixture.componentInstance as TestableAreaFormDialog;

    component.form.get('countryId')!.setValue('c-india');

    expect(component.form.get('stateId')?.disabled).toBe(false);
    expect(component.form.get('cityId')?.disabled).toBe(false);
    expect(component.form.get('postalCodeId')?.disabled).toBe(false);
    expect(component.stateLabel()).toBe('State');
    expect(component.cityLabel()).toBe('City');
    expect(component.postalCodeLabel()).toBe('Postal Code');
    expect(component.stateOptions().map((o) => o.label)).toEqual(['Tamil Nadu (TN)', 'Maharashtra (MH)']);
    expect(component.cityOptions().map((o) => o.label)).toEqual(['Chennai (CHN)', 'Mumbai (MUM)']);
    expect(component.postalCodeOptions().map((o) => o.label)).toEqual(['600001', '600002', '400001']);
  });

  it('gates State and Postal Code independently of City for a country with mixed capability flags', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    flushLookups();
    const component = fixture.componentInstance as TestableAreaFormDialog;

    // Afghanistan: hasState=false, hasCity=true, hasPostalCode=false.
    component.form.get('countryId')!.setValue('c-afg');

    expect(component.form.get('stateId')?.disabled).toBe(true);
    expect(component.stateLabel()).toBe('State (not applicable)');
    expect(component.form.get('cityId')?.disabled).toBe(false);
    expect(component.cityLabel()).toBe('City');
    expect(component.cityOptions().map((o) => o.label)).toEqual(['Kabul (KBL)']);
    expect(component.form.get('postalCodeId')?.disabled).toBe(true);
    expect(component.postalCodeLabel()).toBe('Postal Code (not applicable)');
  });

  it('narrows City to the selected State, and Postal Code to the selected City', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    flushLookups();
    const component = fixture.componentInstance as TestableAreaFormDialog;

    component.form.get('countryId')!.setValue('c-india');
    component.form.get('stateId')!.setValue('s-tn');
    expect(component.cityOptions().map((o) => o.label)).toEqual(['Chennai (CHN)']);
    // Postal Code narrowed by State alone before a City is chosen.
    expect(component.postalCodeOptions().map((o) => o.label)).toEqual(['600001', '600002']);

    component.form.get('cityId')!.setValue('ct-chn');
    expect(component.postalCodeOptions().map((o) => o.label)).toEqual(['600001', '600002']);
  });

  it('clears State, City AND Postal Code when the Country changes', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    flushLookups();
    const component = fixture.componentInstance as TestableAreaFormDialog;

    component.form.get('countryId')!.setValue('c-india');
    component.form.patchValue({ stateId: 's-tn', cityId: 'ct-chn', postalCodeId: 'pc-1' });
    expect(component.form.get('postalCodeId')?.value).toBe('pc-1');

    component.form.get('countryId')!.setValue('');
    expect(component.form.get('stateId')?.value).toBe('');
    expect(component.form.get('cityId')?.value).toBe('');
    expect(component.form.get('postalCodeId')?.value).toBe('');
  });

  it('clears City AND Postal Code (not Country or State) when the State changes', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    flushLookups();
    const component = fixture.componentInstance as TestableAreaFormDialog;

    component.form.get('countryId')!.setValue('c-india');
    component.form.patchValue({ stateId: 's-tn', cityId: 'ct-chn', postalCodeId: 'pc-1' });

    component.form.get('stateId')!.setValue('s-mh');
    expect(component.form.get('cityId')?.value).toBe('');
    expect(component.form.get('postalCodeId')?.value).toBe('');
    expect(component.form.get('countryId')?.value).toBe('c-india');
  });

  it('clears only Postal Code (not Country/State/City) when the City changes', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    flushLookups();
    const component = fixture.componentInstance as TestableAreaFormDialog;

    component.form.get('countryId')!.setValue('c-india');
    component.form.get('stateId')!.setValue('s-tn');
    component.form.patchValue({ cityId: 'ct-chn', postalCodeId: 'pc-1' });

    component.form.get('cityId')!.setValue('ct-mum');
    expect(component.form.get('postalCodeId')?.value).toBe('');
    expect(component.form.get('stateId')?.value).toBe('s-tn');
  });

  it('does not submit when Country/Area Name are empty', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    flushLookups();
    const component = fixture.componentInstance as TestableAreaFormDialog;

    component.onSubmit();

    expect(dialogRefCloseSpy).not.toHaveBeenCalled();
    httpMock.expectNone(apiUrl('master/area/add'));
  });

  it('submits to master/area/add with Country + Area Name only (no location levels)', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    flushLookups();
    const component = fixture.componentInstance as TestableAreaFormDialog;

    component.form.get('countryId')!.setValue('c-afg');
    component.form.patchValue({ areaName: 'Kabul Central' });
    component.onSubmit();

    const req = httpMock.expectOne(apiUrl('master/area/add'));
    expect(req.request.body.areaId).toBeNull();
    expect(req.request.body.countryId).toBe('c-afg');
    expect(req.request.body.stateId).toBeNull();
    expect(req.request.body.postalCodeId).toBeNull();
    expect(req.request.body.areaName).toBe('Kabul Central');
    req.flush({ success: true, data: null });

    expect(dialogRefCloseSpy).toHaveBeenCalledWith(true);
  });

  it('submits with the full Country + State + City + Postal Code chain set', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    flushLookups();
    const component = fixture.componentInstance as TestableAreaFormDialog;

    component.form.get('countryId')!.setValue('c-india');
    component.form.get('stateId')!.setValue('s-tn');
    component.form.get('cityId')!.setValue('ct-chn');
    component.form.patchValue({ postalCodeId: 'pc-1', areaCode: 'CHN-ADY', areaName: 'Adyar' });
    component.onSubmit();

    const req = httpMock.expectOne(apiUrl('master/area/add'));
    expect(req.request.body.stateId).toBe('s-tn');
    expect(req.request.body.cityId).toBe('ct-chn');
    expect(req.request.body.postalCodeId).toBe('pc-1');
    req.flush({ success: true, data: null });
  });

  it('submits to master/area/edit with the existing areaId and restores the saved relationship', () => {
    const existingRow: AreaRow = { areaId: 'a1', countryId: 'c-india', stateId: 's-tn', cityId: 'ct-chn', postalCodeId: 'pc-1', areaName: 'Adyar', isActive: true };
    const fixture = createComponent({ row: existingRow, mode: 'edit' });
    flushLookups();
    const component = fixture.componentInstance as TestableAreaFormDialog;

    expect(component.form.get('countryId')?.value).toBe('c-india');
    expect(component.form.get('stateId')?.value).toBe('s-tn');
    expect(component.form.get('cityId')?.value).toBe('ct-chn');
    expect(component.form.get('postalCodeId')?.value).toBe('pc-1');

    component.onSubmit();

    const req = httpMock.expectOne(apiUrl('master/area/edit'));
    expect(req.request.body.areaId).toBe('a1');
    expect(req.request.body.stateId).toBe('s-tn');
    expect(req.request.body.cityId).toBe('ct-chn');
    expect(req.request.body.postalCodeId).toBe('pc-1');
    req.flush({ success: true, data: null });

    expect(dialogRefCloseSpy).toHaveBeenCalledWith(true);
  });
});
