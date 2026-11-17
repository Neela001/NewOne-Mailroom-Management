import { TestBed } from '@angular/core/testing';
import { DIALOG_DATA } from '../../../shared/ui/dialog/dialog-data.token';
import { DialogRef } from '../../../shared/ui/dialog/dialog-ref';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { FormGroup } from '@angular/forms';
import { BranchFormDialogComponent, BranchFormDialogData } from './branch-form-dialog.component';
import { ConfigService } from '../../../core/services/config.service';
import { BranchRow } from './branch.model';
import { SelectOption } from '../../../shared/ui/form/select.component';
import { provideAppIcons } from '../../../shared/ui/icon/lucide-icons.provider';

type TestableBranchFormDialog = BranchFormDialogComponent & {
  form: FormGroup;
  companyOptions: () => SelectOption[];
  countryOptions: () => SelectOption[];
  cityOptions: () => SelectOption[];
  siteOptions: () => SelectOption[];
  selectedLocationCount: () => number;
  locationRows: () => { wingId?: string | null; buildingName?: string | null; floorName?: string | null; wingName?: string | null; isChecked: boolean }[];
  errorMessage: () => string | null;
  toggleLocationRow: (row: { wingId?: string | null }) => void;
  isLocationRowChecked: (row: { wingId?: string | null }) => boolean;
};

const COMPANY_ROWS = [{ CompanyId: 'co-1', CompanyCode: 'DEMO-COMP', CompanyName: 'Demo Technologies Pvt Ltd', IsActive: true }];
const COUNTRY_ROWS = [{ CountryId: 'c-india', CountryCode: 'IN', CountryName: 'India', HasCity: true, IsActive: true }];
const CITY_ROWS = [{ CityId: 'ct-chn', CountryId: 'c-india', CityCode: 'CHN', CityName: 'Chennai', IsActive: true }];
const SITE_ROWS = [
  {
    SiteId: 'site-chn',
    CityId: 'ct-chn',
    SiteCode: 'CHN01',
    SiteName: 'Chennai Corporate Site',
    StateId: 's-tn',
    StateCode: 'TN',
    StateName: 'Tamil Nadu',
    PostalCodeId: 'pc-1',
    PostalCodeCode: '600001',
    AreaId: 'a-1',
    AreaCode: 'CHN-CEN',
    AreaName: 'Chennai Central',
    IsActive: true,
  },
];
const LOCATION_OPTIONS_ROWS = [
  { SiteId: 'site-chn', BuildingId: 'bld-a', BuildingName: 'Corporate Tower A', FloorId: 'flr-01', FloorName: 'First Floor', WingId: 'wng-a', WingName: 'Wing A', BranchLocationId: null, IsAvailable: true, IsChecked: false },
  { SiteId: 'site-chn', BuildingId: 'bld-a', BuildingName: 'Corporate Tower A', FloorId: 'flr-02', FloorName: 'Second Floor', WingId: 'wng-b', WingName: 'Wing B', BranchLocationId: null, IsAvailable: true, IsChecked: false },
];

// Covers the Company -> Country -> City -> Site dependency this task
// calls out as critical (Company does NOT reset or filter Country/City/
// Site — CONFIRMED LIVE no such backend relationship exists), the
// read-only State/Postal Code/Area fields auto-populated from the
// selected Site's own real denormalized chain, the Branch Location
// Selection grid loading only after Site selection and tracking a real
// checked-row count, and — the two real, confirmed-live backend rules
// this task's own brief did not anticipate — that Save is blocked with
// zero locations checked, and that the submit payload always carries the
// Site-derived state/postalCode/area ids alongside the checked
// Building/Floor/Wing combinations.
describe('BranchFormDialogComponent', () => {
  let httpMock: HttpTestingController;
  let dialogRefCloseSpy: ReturnType<typeof vi.fn>;

  function apiUrl(path: string): string {
    return `${TestBed.inject(ConfigService).getApiUrl()}${path}`;
  }

  function createComponent(data: BranchFormDialogData) {
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
    const fixture = TestBed.createComponent(BranchFormDialogComponent);
    fixture.detectChanges();
    return fixture;
  }

  function flushLookups(
    companies: Record<string, unknown>[] = COMPANY_ROWS,
    countries: Record<string, unknown>[] = COUNTRY_ROWS,
    cities: Record<string, unknown>[] = CITY_ROWS,
    sites: Record<string, unknown>[] = SITE_ROWS,
  ) {
    httpMock.expectOne(apiUrl('master/company/get')).flush({ success: true, data: companies });
    httpMock.expectOne(apiUrl('master/country/get')).flush({ success: true, data: countries });
    httpMock.expectOne(apiUrl('master/city/get')).flush({ success: true, data: cities });
    httpMock.expectOne(apiUrl('master/site/get')).flush({ success: true, data: sites });
  }

  function flushLocationOptions(rows: Record<string, unknown>[] = LOCATION_OPTIONS_ROWS) {
    httpMock.expectOne(apiUrl('master/branch/location-options/get')).flush({ success: true, data: rows });
  }

  afterEach(() => httpMock.verify());

  it('keeps City and Site disabled before Country/City are selected, independent of Company', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    flushLookups();
    const component = fixture.componentInstance as TestableBranchFormDialog;

    expect(component.form.get('cityId')?.disabled).toBe(true);
    expect(component.form.get('siteId')?.disabled).toBe(true);

    component.form.get('companyId')!.setValue('co-1');
    expect(component.form.get('cityId')?.disabled).toBe(true);
    expect(component.countryOptions().map((o) => o.label)).toEqual(['India (IN)']);
  });

  it('enables City once Country is selected, and Site once City is selected', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    flushLookups();
    const component = fixture.componentInstance as TestableBranchFormDialog;

    component.form.get('countryId')!.setValue('c-india');
    expect(component.form.get('cityId')?.disabled).toBe(false);
    expect(component.cityOptions().map((o) => o.label)).toEqual(['Chennai (CHN)']);

    component.form.get('cityId')!.setValue('ct-chn');
    expect(component.form.get('siteId')?.disabled).toBe(false);
    expect(component.siteOptions().map((o) => o.label)).toEqual(['Chennai Corporate Site (CHN01)']);
  });

  it('populates read-only State/Postal Code/Area from the selected Site, and loads the location grid', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    flushLookups();
    const component = fixture.componentInstance as TestableBranchFormDialog;

    component.form.get('countryId')!.setValue('c-india');
    component.form.get('cityId')!.setValue('ct-chn');
    component.form.get('siteId')!.setValue('site-chn');
    flushLocationOptions();

    expect(component.form.get('stateDisplay')?.value).toBe('Tamil Nadu (TN)');
    expect(component.form.get('postalCodeDisplay')?.value).toBe('600001');
    expect(component.form.get('areaDisplay')?.value).toBe('Chennai Central (CHN-CEN)');
    expect(component.locationRows().map((r) => r.wingName)).toEqual(['Wing A', 'Wing B']);
  });

  it('tracks the selected location count as rows are checked and unchecked', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    flushLookups();
    const component = fixture.componentInstance as TestableBranchFormDialog;

    component.form.get('countryId')!.setValue('c-india');
    component.form.get('cityId')!.setValue('ct-chn');
    component.form.get('siteId')!.setValue('site-chn');
    flushLocationOptions();

    expect(component.selectedLocationCount()).toBe(0);
    const [rowA, rowB] = component.locationRows();
    component.toggleLocationRow(rowA);
    expect(component.selectedLocationCount()).toBe(1);
    component.toggleLocationRow(rowB);
    expect(component.selectedLocationCount()).toBe(2);
    component.toggleLocationRow(rowA);
    expect(component.selectedLocationCount()).toBe(1);
  });

  it('clears City, Site, derived fields and the location grid when Country changes', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    flushLookups();
    const component = fixture.componentInstance as TestableBranchFormDialog;

    component.form.get('countryId')!.setValue('c-india');
    component.form.get('cityId')!.setValue('ct-chn');
    component.form.get('siteId')!.setValue('site-chn');
    flushLocationOptions();
    component.toggleLocationRow(component.locationRows()[0]);

    component.form.get('countryId')!.setValue('');
    expect(component.form.get('cityId')?.value).toBe('');
    expect(component.form.get('siteId')?.value).toBe('');
    expect(component.form.get('stateDisplay')?.value).toBe('');
    expect(component.locationRows()).toEqual([]);
    expect(component.selectedLocationCount()).toBe(0);
  });

  it('does not submit when Company/Country/City/Site/Branch Code/Branch Name are empty', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    flushLookups();
    const component = fixture.componentInstance as TestableBranchFormDialog;

    component.onSubmit();

    expect(dialogRefCloseSpy).not.toHaveBeenCalled();
    httpMock.expectNone(apiUrl('master/branch/save-with-locations'));
  });

  it('blocks submit with a real-confirmed error when all required fields are set but no location is checked', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    flushLookups();
    const component = fixture.componentInstance as TestableBranchFormDialog;

    component.form.get('companyId')!.setValue('co-1');
    component.form.get('countryId')!.setValue('c-india');
    component.form.get('cityId')!.setValue('ct-chn');
    component.form.get('siteId')!.setValue('site-chn');
    flushLocationOptions();
    component.form.patchValue({ branchCode: 'CHN-HO', branchName: 'Chennai Head Office' });

    component.onSubmit();

    expect(component.errorMessage()).toBe('Select at least one Branch Location before saving.');
    expect(dialogRefCloseSpy).not.toHaveBeenCalled();
    httpMock.expectNone(apiUrl('master/branch/save-with-locations'));
  });

  it('submits the Site-derived state/postalCode/area ids and the checked locations array', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    flushLookups();
    const component = fixture.componentInstance as TestableBranchFormDialog;

    component.form.get('companyId')!.setValue('co-1');
    component.form.get('countryId')!.setValue('c-india');
    component.form.get('cityId')!.setValue('ct-chn');
    component.form.get('siteId')!.setValue('site-chn');
    flushLocationOptions();
    component.toggleLocationRow(component.locationRows()[0]);
    component.form.patchValue({ branchCode: 'CHN-HO', branchName: 'Chennai Head Office' });

    component.onSubmit();

    const req = httpMock.expectOne(apiUrl('master/branch/save-with-locations'));
    expect(req.request.body.branchId).toBeNull();
    expect(req.request.body.stateId).toBe('s-tn');
    expect(req.request.body.postalCodeId).toBe('pc-1');
    expect(req.request.body.areaId).toBe('a-1');
    expect(req.request.body.locations).toEqual([{ siteId: 'site-chn', buildingId: 'bld-a', floorId: 'flr-01', wingId: 'wng-a' }]);
    req.flush({ success: true, data: null });

    expect(dialogRefCloseSpy).toHaveBeenCalledWith(true);
  });

  it('restores the saved Branch on Edit — resolving Site from the branch\'s own existing BranchLocation rows (BranchRow itself has no siteId field) — pre-checks the grid rows the real server marks isChecked, and submits to the same save-with-locations endpoint', () => {
    const existingRow: BranchRow = { branchId: 'b1', companyId: 'co-1', companyCode: 'DEMO-COMP', companyName: 'Demo Technologies Pvt Ltd', branchCode: 'CHN-HO', branchName: 'Chennai Head Office', countryId: 'c-india', cityId: 'ct-chn', isActive: true };
    const fixture = createComponent({ row: existingRow, mode: 'edit' });
    httpMock.expectOne(apiUrl('master/company/get')).flush({ success: true, data: COMPANY_ROWS });
    httpMock.expectOne(apiUrl('master/country/get')).flush({ success: true, data: COUNTRY_ROWS });
    httpMock.expectOne(apiUrl('master/city/get')).flush({ success: true, data: CITY_ROWS });
    httpMock.expectOne(apiUrl('master/site/get')).flush({ success: true, data: SITE_ROWS });
    const component = fixture.componentInstance as TestableBranchFormDialog;

    expect(component.form.get('countryId')?.value).toBe('c-india');
    expect(component.form.get('cityId')?.value).toBe('ct-chn');

    // ngOnInit also fires resolveSavedSiteFromExistingLocations() for
    // Edit mode — flushing it triggers siteId restoration, which in turn
    // loads the pre-checked grid via location-options/get.
    httpMock.expectOne(apiUrl('master/branch/location/get')).flush({ success: true, data: [{ SiteId: 'site-chn', BuildingId: 'bld-a', FloorId: 'flr-01', WingId: 'wng-a', BranchLocationId: 'bl-1' }] });

    expect(component.form.get('siteId')?.value).toBe('site-chn');
    expect(component.form.get('stateDisplay')?.value).toBe('Tamil Nadu (TN)');

    httpMock
      .expectOne(apiUrl('master/branch/location-options/get'))
      .flush({ success: true, data: [{ ...LOCATION_OPTIONS_ROWS[0], IsChecked: true, BranchLocationId: 'bl-1' }, LOCATION_OPTIONS_ROWS[1]] });

    expect(component.selectedLocationCount()).toBe(1);

    component.onSubmit();

    const req = httpMock.expectOne(apiUrl('master/branch/save-with-locations'));
    expect(req.request.body.branchId).toBe('b1');
    expect(req.request.body.locations).toEqual([{ siteId: 'site-chn', buildingId: 'bld-a', floorId: 'flr-01', wingId: 'wng-a' }]);
    req.flush({ success: true, data: null });

    expect(dialogRefCloseSpy).toHaveBeenCalledWith(true);
  });
});
