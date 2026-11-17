import { TestBed } from '@angular/core/testing';
import { DIALOG_DATA } from '../../../shared/ui/dialog/dialog-data.token';
import { DialogRef } from '../../../shared/ui/dialog/dialog-ref';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { FormGroup } from '@angular/forms';
import { FloorFormDialogComponent, FloorFormDialogData } from './floor-form-dialog.component';
import { ConfigService } from '../../../core/services/config.service';
import { FloorRow } from './floor.model';
import { SelectOption } from '../../../shared/ui/form/select.component';
import { provideAppIcons } from '../../../shared/ui/icon/lucide-icons.provider';

type TestableFloorFormDialog = FloorFormDialogComponent & {
  form: FormGroup;
  siteOptions: () => SelectOption[];
  buildingOptions: () => SelectOption[];
};

const SITE_ROWS = [
  { SiteId: 'site-chn', SiteCode: 'CHN01', SiteName: 'Chennai Corporate Site', IsActive: true },
  { SiteId: 'site-sinr', SiteCode: 'SINR', SiteName: 'Sivanthi Nagar', IsActive: true },
];

const BUILDING_ROWS = [
  { BuildingId: 'bld-a', SiteId: 'site-chn', BuildingCode: 'BLD-A', BuildingName: 'Corporate Tower A', BuildingType: 'COMMERCIAL', IsActive: true },
  { BuildingId: 'bld-b', SiteId: 'site-sinr', BuildingCode: 'SKKS', BuildingName: 'KRISHANYA', BuildingType: 'RESIDENTIAL', IsActive: true },
];

// Covers the Site -> Building dependency logic this task calls out as
// critical (Building disabled until a Site is chosen, client-side
// filtered to that Site's own real buildings, cleared on Site change),
// and — the most important correctness detail — that Floor Number 0 and
// negative values are preserved exactly, never treated as empty by a
// `||`/truthy check.
describe('FloorFormDialogComponent', () => {
  let httpMock: HttpTestingController;
  let dialogRefCloseSpy: ReturnType<typeof vi.fn>;

  function apiUrl(path: string): string {
    return `${TestBed.inject(ConfigService).getApiUrl()}${path}`;
  }

  function createComponent(data: FloorFormDialogData) {
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
    const fixture = TestBed.createComponent(FloorFormDialogComponent);
    fixture.detectChanges();
    return fixture;
  }

  function flushLookups(sites: Record<string, unknown>[] = SITE_ROWS, buildings: Record<string, unknown>[] = BUILDING_ROWS) {
    httpMock.expectOne(apiUrl('master/site/get')).flush({ success: true, data: sites });
    httpMock.expectOne(apiUrl('master/building/get')).flush({ success: true, data: buildings });
  }

  afterEach(() => httpMock.verify());

  it('keeps Building disabled and empty before a Site is selected', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    flushLookups();
    const component = fixture.componentInstance as TestableFloorFormDialog;

    expect(component.buildingOptions()).toEqual([]);
    expect(component.form.get('buildingId')?.disabled).toBe(true);
  });

  it('enables Building and loads only the selected Site\'s own buildings', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    flushLookups();
    const component = fixture.componentInstance as TestableFloorFormDialog;

    component.form.get('siteId')!.setValue('site-chn');

    expect(component.form.get('buildingId')?.disabled).toBe(false);
    expect(component.buildingOptions().map((o) => o.label)).toEqual(['Corporate Tower A (BLD-A)']);
  });

  it('clears Building when the Site changes', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    flushLookups();
    const component = fixture.componentInstance as TestableFloorFormDialog;

    component.form.get('siteId')!.setValue('site-chn');
    component.form.get('buildingId')!.setValue('bld-a');
    expect(component.form.get('buildingId')?.value).toBe('bld-a');

    component.form.get('siteId')!.setValue('site-sinr');
    expect(component.form.get('buildingId')?.value).toBe('');
    expect(component.buildingOptions().map((o) => o.label)).toEqual(['KRISHANYA (SKKS)']);
  });

  it('does not submit when Site/Building/Floor Code/Floor Name are empty', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    flushLookups();
    const component = fixture.componentInstance as TestableFloorFormDialog;

    component.onSubmit();

    expect(dialogRefCloseSpy).not.toHaveBeenCalled();
    httpMock.expectNone(apiUrl('master/floor/add'));
  });

  it('submits with floorNumber null when left empty (optional field)', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    flushLookups();
    const component = fixture.componentInstance as TestableFloorFormDialog;

    component.form.get('siteId')!.setValue('site-chn');
    component.form.patchValue({ buildingId: 'bld-a', floorCode: '01', floorName: 'First Floor' });
    component.onSubmit();

    const req = httpMock.expectOne(apiUrl('master/floor/add'));
    expect(req.request.body.floorNumber).toBeNull();
    req.flush({ success: true, data: null });

    expect(dialogRefCloseSpy).toHaveBeenCalledWith(true);
  });

  it('preserves a Floor Number of exactly 0 — never treats it as empty', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    flushLookups();
    const component = fixture.componentInstance as TestableFloorFormDialog;

    component.form.get('siteId')!.setValue('site-chn');
    component.form.patchValue({ buildingId: 'bld-a', floorCode: 'GF', floorName: 'Ground Floor', floorNumber: '0' });
    component.onSubmit();

    const req = httpMock.expectOne(apiUrl('master/floor/add'));
    expect(req.request.body.floorNumber).toBe(0);
    req.flush({ success: true, data: null });
  });

  it('preserves a negative Floor Number (basement level)', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    flushLookups();
    const component = fixture.componentInstance as TestableFloorFormDialog;

    component.form.get('siteId')!.setValue('site-chn');
    component.form.patchValue({ buildingId: 'bld-a', floorCode: 'B1', floorName: 'Basement 1', floorNumber: '-1' });
    component.onSubmit();

    const req = httpMock.expectOne(apiUrl('master/floor/add'));
    expect(req.request.body.floorNumber).toBe(-1);
    req.flush({ success: true, data: null });
  });

  it('restores a saved Floor Number of 0 into the form on Edit (not blank)', () => {
    const existingRow: FloorRow = { floorId: 'f1', siteId: 'site-chn', buildingId: 'bld-a', floorCode: 'GF', floorName: 'Ground Floor', floorNumber: 0, isActive: true };
    const fixture = createComponent({ row: existingRow, mode: 'edit' });
    flushLookups();
    const component = fixture.componentInstance as TestableFloorFormDialog;

    expect(component.form.get('floorNumber')?.value).toBe('0');
  });

  it('trims leading/trailing spaces from Floor Code and Floor Name on submit', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    flushLookups();
    const component = fixture.componentInstance as TestableFloorFormDialog;

    component.form.get('siteId')!.setValue('site-chn');
    component.form.patchValue({ buildingId: 'bld-a', floorCode: '  01  ', floorName: '  First Floor  ' });
    component.onSubmit();

    const req = httpMock.expectOne(apiUrl('master/floor/add'));
    expect(req.request.body.floorCode).toBe('01');
    expect(req.request.body.floorName).toBe('First Floor');
    req.flush({ success: true, data: null });
  });

  it('submits to master/floor/edit with the existing floorId and restores the saved relationship', () => {
    const existingRow: FloorRow = { floorId: 'f1', siteId: 'site-chn', buildingId: 'bld-a', floorCode: '01', floorName: 'First Floor', floorNumber: 1, isActive: true };
    const fixture = createComponent({ row: existingRow, mode: 'edit' });
    flushLookups();
    const component = fixture.componentInstance as TestableFloorFormDialog;

    expect(component.form.get('siteId')?.value).toBe('site-chn');
    expect(component.form.get('buildingId')?.value).toBe('bld-a');

    component.onSubmit();

    const req = httpMock.expectOne(apiUrl('master/floor/edit'));
    expect(req.request.body.floorId).toBe('f1');
    expect(req.request.body.floorNumber).toBe(1);
    req.flush({ success: true, data: null });

    expect(dialogRefCloseSpy).toHaveBeenCalledWith(true);
  });
});
