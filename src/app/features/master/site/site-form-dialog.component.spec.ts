import { TestBed } from '@angular/core/testing';
import { DIALOG_DATA } from '../../../shared/ui/dialog/dialog-data.token';
import { DialogRef } from '../../../shared/ui/dialog/dialog-ref';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { FormGroup } from '@angular/forms';
import { SiteFormDialogComponent, SiteFormDialogData } from './site-form-dialog.component';
import { ConfigService } from '../../../core/services/config.service';
import { SiteRow } from './site.model';
import { SelectOption } from '../../../shared/ui/form/select.component';
import { provideAppIcons } from '../../../shared/ui/icon/lucide-icons.provider';

type TestableSiteFormDialog = SiteFormDialogComponent & {
  form: FormGroup;
  countryOptions: () => SelectOption[];
  stateOptions: () => SelectOption[];
  cityOptions: () => SelectOption[];
  postalCodeOptions: () => SelectOption[];
  areaOptions: () => SelectOption[];
  stateLabel: () => string;
  cityLabel: () => string;
  postalCodeLabel: () => string;
  areaLabel: () => string;
};

// India supports all four levels. Afghanistan deliberately mixes flags
// (hasState=false, hasCity=true, hasPostalCode=false, hasArea=false — the
// same real, confirmed-live combination Area Master's own investigation
// found, extended here with hasArea=false too), used to prove each
// dependent level is gated by its OWN capability flag independently.
const COUNTRY_ROWS = [
  { CountryId: 'c-india', CountryCode: 'IN', CountryName: 'India', HasState: true, HasCity: true, HasPostalCode: true, HasArea: true, IsActive: true },
  { CountryId: 'c-afg', CountryCode: 'AFG', CountryName: 'Afghanistan', HasState: false, HasCity: true, HasPostalCode: false, HasArea: false, IsActive: true },
];

const STATE_ROWS = [{ StateId: 's-tn', CountryId: 'c-india', StateCode: 'TN', StateName: 'Tamil Nadu', IsActive: true }];

const CITY_ROWS = [
  { CityId: 'ct-chn', CountryId: 'c-india', StateId: 's-tn', CityCode: 'CHN', CityName: 'Chennai', IsActive: true },
  { CityId: 'ct-kbl', CountryId: 'c-afg', StateId: null, CityCode: 'KBL', CityName: 'Kabul', IsActive: true },
];

const POSTALCODE_ROWS = [{ PostalCodeId: 'pc-1', CountryId: 'c-india', StateId: 's-tn', CityId: 'ct-chn', PostalCode: '600001', IsActive: true }];

const AREA_ROWS = [{ AreaId: 'a-1', CountryId: 'c-india', StateId: 's-tn', CityId: 'ct-chn', PostalCodeId: 'pc-1', AreaCode: 'CHN-ADY', AreaName: 'Adyar', IsActive: true }];

// Covers the 5-level Country -> State -> City -> Postal Code -> Area
// dependency logic this task calls out as critical: the Country dropdown
// loads all active countries (Site itself has no capability flag of its
// own); State/City/Postal Code/Area each independently gated and
// dynamically relabeled "(not applicable)" by its own real country
// capability flag (not chained to each other); each level narrowed by its
// own selected parent; the full reset cascade (Country clears all four,
// State clears City+Postal Code+Area, City clears Postal Code+Area,
// Postal Code clears Area only); and never sending a fabricated
// State/City/PostalCode/Area ID.
describe('SiteFormDialogComponent', () => {
  let httpMock: HttpTestingController;
  let dialogRefCloseSpy: ReturnType<typeof vi.fn>;

  function apiUrl(path: string): string {
    return `${TestBed.inject(ConfigService).getApiUrl()}${path}`;
  }

  function createComponent(data: SiteFormDialogData) {
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
    const fixture = TestBed.createComponent(SiteFormDialogComponent);
    fixture.detectChanges();
    return fixture;
  }

  function flushLookups(
    countries: Record<string, unknown>[] = COUNTRY_ROWS,
    states: Record<string, unknown>[] = STATE_ROWS,
    cities: Record<string, unknown>[] = CITY_ROWS,
    postalCodes: Record<string, unknown>[] = POSTALCODE_ROWS,
    areas: Record<string, unknown>[] = AREA_ROWS,
  ) {
    httpMock.expectOne(apiUrl('master/country/get')).flush({ success: true, data: countries });
    httpMock.expectOne(apiUrl('master/state/get')).flush({ success: true, data: states });
    httpMock.expectOne(apiUrl('master/city/get')).flush({ success: true, data: cities });
    httpMock.expectOne(apiUrl('master/postalcode/get')).flush({ success: true, data: postalCodes });
    httpMock.expectOne(apiUrl('master/area/get')).flush({ success: true, data: areas });
  }

  afterEach(() => httpMock.verify());

  it('offers all active countries (Site has no capability flag of its own)', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    flushLookups();
    const component = fixture.componentInstance as TestableSiteFormDialog;

    expect(component.countryOptions().map((o) => o.label)).toEqual(['India (IN)', 'Afghanistan (AFG)']);
  });

  it('keeps State/City/Postal Code/Area disabled and empty before a Country is selected', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    flushLookups();
    const component = fixture.componentInstance as TestableSiteFormDialog;

    expect(component.stateOptions()).toEqual([]);
    expect(component.cityOptions()).toEqual([]);
    expect(component.postalCodeOptions()).toEqual([]);
    expect(component.areaOptions()).toEqual([]);
    expect(component.form.get('stateId')?.disabled).toBe(true);
    expect(component.form.get('cityId')?.disabled).toBe(true);
    expect(component.form.get('postalCodeId')?.disabled).toBe(true);
    expect(component.form.get('areaId')?.disabled).toBe(true);
  });

  it('enables all four dependents and loads their options once a fully-capable Country is chosen', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    flushLookups();
    const component = fixture.componentInstance as TestableSiteFormDialog;

    component.form.get('countryId')!.setValue('c-india');

    expect(component.form.get('stateId')?.disabled).toBe(false);
    expect(component.form.get('cityId')?.disabled).toBe(false);
    expect(component.form.get('postalCodeId')?.disabled).toBe(false);
    expect(component.form.get('areaId')?.disabled).toBe(false);
    expect(component.stateLabel()).toBe('State');
    expect(component.cityLabel()).toBe('City');
    expect(component.postalCodeLabel()).toBe('Postal Code');
    expect(component.areaLabel()).toBe('Area');
    expect(component.stateOptions().map((o) => o.label)).toEqual(['Tamil Nadu (TN)']);
    expect(component.cityOptions().map((o) => o.label)).toEqual(['Chennai (CHN)']);
    expect(component.postalCodeOptions().map((o) => o.label)).toEqual(['600001']);
    expect(component.areaOptions().map((o) => o.label)).toEqual(['Adyar (CHN-ADY)']);
  });

  it('gates State/Postal Code/Area independently of City for a country with mixed capability flags', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    flushLookups();
    const component = fixture.componentInstance as TestableSiteFormDialog;

    // Afghanistan: hasState=false, hasCity=true, hasPostalCode=false, hasArea=false.
    component.form.get('countryId')!.setValue('c-afg');

    expect(component.form.get('stateId')?.disabled).toBe(true);
    expect(component.stateLabel()).toBe('State (not applicable)');
    expect(component.form.get('cityId')?.disabled).toBe(false);
    expect(component.cityLabel()).toBe('City');
    expect(component.cityOptions().map((o) => o.label)).toEqual(['Kabul (KBL)']);
    expect(component.form.get('postalCodeId')?.disabled).toBe(true);
    expect(component.postalCodeLabel()).toBe('Postal Code (not applicable)');
    expect(component.form.get('areaId')?.disabled).toBe(true);
    expect(component.areaLabel()).toBe('Area (not applicable)');
  });

  it('clears State, City, Postal Code AND Area when the Country changes', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    flushLookups();
    const component = fixture.componentInstance as TestableSiteFormDialog;

    component.form.get('countryId')!.setValue('c-india');
    component.form.patchValue({ stateId: 's-tn', cityId: 'ct-chn', postalCodeId: 'pc-1', areaId: 'a-1' });
    expect(component.form.get('areaId')?.value).toBe('a-1');

    component.form.get('countryId')!.setValue('');
    expect(component.form.get('stateId')?.value).toBe('');
    expect(component.form.get('cityId')?.value).toBe('');
    expect(component.form.get('postalCodeId')?.value).toBe('');
    expect(component.form.get('areaId')?.value).toBe('');
  });

  it('clears City, Postal Code AND Area (not Country or State) when the State changes', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    flushLookups();
    const component = fixture.componentInstance as TestableSiteFormDialog;

    component.form.get('countryId')!.setValue('c-india');
    component.form.get('stateId')!.setValue('s-tn');
    component.form.patchValue({ cityId: 'ct-chn', postalCodeId: 'pc-1', areaId: 'a-1' });

    component.form.get('stateId')!.setValue('');
    expect(component.form.get('cityId')?.value).toBe('');
    expect(component.form.get('postalCodeId')?.value).toBe('');
    expect(component.form.get('areaId')?.value).toBe('');
    expect(component.form.get('countryId')?.value).toBe('c-india');
  });

  it('clears Postal Code AND Area (not Country/State/City) when the City changes', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    flushLookups();
    const component = fixture.componentInstance as TestableSiteFormDialog;

    component.form.get('countryId')!.setValue('c-india');
    component.form.get('stateId')!.setValue('s-tn');
    component.form.patchValue({ cityId: 'ct-chn', postalCodeId: 'pc-1', areaId: 'a-1' });

    component.form.get('cityId')!.setValue('');
    expect(component.form.get('postalCodeId')?.value).toBe('');
    expect(component.form.get('areaId')?.value).toBe('');
    expect(component.form.get('stateId')?.value).toBe('s-tn');
  });

  it('clears only Area (not Country/State/City/Postal Code) when the Postal Code changes', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    flushLookups();
    const component = fixture.componentInstance as TestableSiteFormDialog;

    component.form.get('countryId')!.setValue('c-india');
    component.form.get('stateId')!.setValue('s-tn');
    component.form.get('cityId')!.setValue('ct-chn');
    component.form.patchValue({ postalCodeId: 'pc-1', areaId: 'a-1' });

    component.form.get('postalCodeId')!.setValue('');
    expect(component.form.get('areaId')?.value).toBe('');
    expect(component.form.get('cityId')?.value).toBe('ct-chn');
  });

  it('does not submit when Country/Site Code/Site Name are empty', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    flushLookups();
    const component = fixture.componentInstance as TestableSiteFormDialog;

    component.onSubmit();

    expect(dialogRefCloseSpy).not.toHaveBeenCalled();
    httpMock.expectNone(apiUrl('master/site/add'));
  });

  it('trims leading/trailing spaces from Site Code and Site Name on submit', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    flushLookups();
    const component = fixture.componentInstance as TestableSiteFormDialog;

    component.form.get('countryId')!.setValue('c-afg');
    component.form.patchValue({ siteCode: '  KBL01  ', siteName: '  Kabul Depot  ' });
    component.onSubmit();

    const req = httpMock.expectOne(apiUrl('master/site/add'));
    expect(req.request.body.siteCode).toBe('KBL01');
    expect(req.request.body.siteName).toBe('Kabul Depot');
    req.flush({ success: true, data: null });

    expect(dialogRefCloseSpy).toHaveBeenCalledWith(true);
  });

  it('submits to master/site/add with Country + Site Code + Site Name only (no location levels)', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    flushLookups();
    const component = fixture.componentInstance as TestableSiteFormDialog;

    component.form.get('countryId')!.setValue('c-afg');
    component.form.patchValue({ siteCode: 'KBL01', siteName: 'Kabul Depot' });
    component.onSubmit();

    const req = httpMock.expectOne(apiUrl('master/site/add'));
    expect(req.request.body.siteId).toBeNull();
    expect(req.request.body.countryId).toBe('c-afg');
    expect(req.request.body.stateId).toBeNull();
    expect(req.request.body.cityId).toBeNull();
    expect(req.request.body.postalCodeId).toBeNull();
    expect(req.request.body.areaId).toBeNull();
    req.flush({ success: true, data: null });

    expect(dialogRefCloseSpy).toHaveBeenCalledWith(true);
  });

  it('submits with the full Country + State + City + Postal Code + Area chain set', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    flushLookups();
    const component = fixture.componentInstance as TestableSiteFormDialog;

    component.form.get('countryId')!.setValue('c-india');
    component.form.get('stateId')!.setValue('s-tn');
    component.form.get('cityId')!.setValue('ct-chn');
    component.form.get('postalCodeId')!.setValue('pc-1');
    component.form.patchValue({ areaId: 'a-1', siteCode: 'CHN01', siteName: 'Chennai Corporate Site' });
    component.onSubmit();

    const req = httpMock.expectOne(apiUrl('master/site/add'));
    expect(req.request.body.stateId).toBe('s-tn');
    expect(req.request.body.cityId).toBe('ct-chn');
    expect(req.request.body.postalCodeId).toBe('pc-1');
    expect(req.request.body.areaId).toBe('a-1');
    req.flush({ success: true, data: null });
  });

  it('submits to master/site/edit with the existing siteId and restores the saved relationship', () => {
    const existingRow: SiteRow = { siteId: 'st1', countryId: 'c-india', stateId: 's-tn', cityId: 'ct-chn', postalCodeId: 'pc-1', areaId: 'a-1', siteCode: 'CHN01', siteName: 'Chennai Corporate Site', isActive: true };
    const fixture = createComponent({ row: existingRow, mode: 'edit' });
    flushLookups();
    const component = fixture.componentInstance as TestableSiteFormDialog;

    expect(component.form.get('countryId')?.value).toBe('c-india');
    expect(component.form.get('stateId')?.value).toBe('s-tn');
    expect(component.form.get('cityId')?.value).toBe('ct-chn');
    expect(component.form.get('postalCodeId')?.value).toBe('pc-1');
    expect(component.form.get('areaId')?.value).toBe('a-1');

    component.onSubmit();

    const req = httpMock.expectOne(apiUrl('master/site/edit'));
    expect(req.request.body.siteId).toBe('st1');
    expect(req.request.body.stateId).toBe('s-tn');
    expect(req.request.body.cityId).toBe('ct-chn');
    expect(req.request.body.postalCodeId).toBe('pc-1');
    expect(req.request.body.areaId).toBe('a-1');
    req.flush({ success: true, data: null });

    expect(dialogRefCloseSpy).toHaveBeenCalledWith(true);
  });
});
