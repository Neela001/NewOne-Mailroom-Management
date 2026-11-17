import { TestBed } from '@angular/core/testing';
import { DIALOG_DATA } from '../../../shared/ui/dialog/dialog-data.token';
import { DialogRef } from '../../../shared/ui/dialog/dialog-ref';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { FormGroup } from '@angular/forms';
import { FlatFormDialogComponent, FlatFormDialogData } from './flat-form-dialog.component';
import { ConfigService } from '../../../core/services/config.service';
import { FlatRow } from './flat.model';
import { SelectOption } from '../../../shared/ui/form/select.component';
import { provideAppIcons } from '../../../shared/ui/icon/lucide-icons.provider';

type TestableFlatFormDialog = FlatFormDialogComponent & {
  form: FormGroup;
  siteOptions: () => SelectOption[];
  buildingOptions: () => SelectOption[];
  floorOptions: () => SelectOption[];
  wingOptions: () => SelectOption[];
  errorMessage: () => string | null;
};

const SITE_ROWS = [{ SiteId: 'site-sinr', SiteCode: 'SINR', SiteName: 'Sivanthi Nagar', IsActive: true }];

// Three buildings under the same site: one eligible (active RESIDENTIAL),
// one COMMERCIAL (must be excluded), one inactive RESIDENTIAL (must be
// excluded) — covers this task's own "Only active RESIDENTIAL buildings
// can have Flats" mandatory rule directly.
const BUILDING_ROWS = [
  { BuildingId: 'bld-res', SiteId: 'site-sinr', BuildingCode: 'SKKS', BuildingName: 'KRISHANYA', BuildingType: 'RESIDENTIAL', IsActive: true },
  { BuildingId: 'bld-com', SiteId: 'site-sinr', BuildingCode: 'COM1', BuildingName: 'Commercial Block', BuildingType: 'COMMERCIAL', IsActive: true },
  { BuildingId: 'bld-inactive', SiteId: 'site-sinr', BuildingCode: 'OLD1', BuildingName: 'Old Residential', BuildingType: 'RESIDENTIAL', IsActive: false },
];

const FLOOR_ROWS = [{ FloorId: 'flr-grd', BuildingId: 'bld-res', FloorCode: 'GRD', FloorName: 'Ground Floor', IsActive: true }];

const WING_ROWS = [{ WingId: 'wng-main', FloorId: 'flr-grd', WingCode: 'MAN', WingName: 'Main Wing', IsActive: true }];

// Covers the Site -> Building -> Floor -> Wing 4-level dependency this
// task calls out as critical, and — the single most important business
// rule in the brief — that only active RESIDENTIAL buildings are ever
// offered as eligible, excluding both COMMERCIAL and inactive buildings,
// matching the real CONFIRMED-LIVE backend rejection message
// ("Only active RESIDENTIAL buildings can have Flats.") this session's
// own investigation found.
describe('FlatFormDialogComponent', () => {
  let httpMock: HttpTestingController;
  let dialogRefCloseSpy: ReturnType<typeof vi.fn>;

  function apiUrl(path: string): string {
    return `${TestBed.inject(ConfigService).getApiUrl()}${path}`;
  }

  function createComponent(data: FlatFormDialogData) {
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
    const fixture = TestBed.createComponent(FlatFormDialogComponent);
    fixture.detectChanges();
    return fixture;
  }

  function flushLookups(
    sites: Record<string, unknown>[] = SITE_ROWS,
    buildings: Record<string, unknown>[] = BUILDING_ROWS,
    floors: Record<string, unknown>[] = FLOOR_ROWS,
    wings: Record<string, unknown>[] = WING_ROWS,
  ) {
    httpMock.expectOne(apiUrl('master/site/get')).flush({ success: true, data: sites });
    httpMock.expectOne(apiUrl('master/building/get')).flush({ success: true, data: buildings });
    httpMock.expectOne(apiUrl('master/floor/get')).flush({ success: true, data: floors });
    httpMock.expectOne(apiUrl('master/wing/get')).flush({ success: true, data: wings });
  }

  afterEach(() => httpMock.verify());

  it('offers only the active RESIDENTIAL building — excludes COMMERCIAL and inactive buildings', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    flushLookups();
    const component = fixture.componentInstance as TestableFlatFormDialog;

    component.form.get('siteId')!.setValue('site-sinr');

    expect(component.buildingOptions().map((o) => o.label)).toEqual(['KRISHANYA (SKKS)']);
  });

  it('keeps Building/Floor/Wing disabled and empty before their own parent is selected', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    flushLookups();
    const component = fixture.componentInstance as TestableFlatFormDialog;

    expect(component.form.get('buildingId')?.disabled).toBe(true);
    expect(component.form.get('floorId')?.disabled).toBe(true);
    expect(component.form.get('wingId')?.disabled).toBe(true);
  });

  it('enables each level in turn and narrows options down the full chain', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    flushLookups();
    const component = fixture.componentInstance as TestableFlatFormDialog;

    component.form.get('siteId')!.setValue('site-sinr');
    expect(component.form.get('buildingId')?.disabled).toBe(false);

    component.form.get('buildingId')!.setValue('bld-res');
    expect(component.form.get('floorId')?.disabled).toBe(false);
    expect(component.floorOptions().map((o) => o.label)).toEqual(['Ground Floor (GRD)']);

    component.form.get('floorId')!.setValue('flr-grd');
    expect(component.form.get('wingId')?.disabled).toBe(false);
    expect(component.wingOptions().map((o) => o.label)).toEqual(['Main Wing (MAN)']);
  });

  it('clears Building, Floor AND Wing when the Site changes', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    flushLookups();
    const component = fixture.componentInstance as TestableFlatFormDialog;

    component.form.get('siteId')!.setValue('site-sinr');
    component.form.get('buildingId')!.setValue('bld-res');
    component.form.get('floorId')!.setValue('flr-grd');
    component.form.get('wingId')!.setValue('wng-main');

    component.form.get('siteId')!.setValue('');
    expect(component.form.get('buildingId')?.value).toBe('');
    expect(component.form.get('floorId')?.value).toBe('');
    expect(component.form.get('wingId')?.value).toBe('');
    expect(component.form.get('wingId')?.disabled).toBe(true);
  });

  it('clears only Wing (not Site/Building) when the Floor changes', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    flushLookups();
    const component = fixture.componentInstance as TestableFlatFormDialog;

    component.form.get('siteId')!.setValue('site-sinr');
    component.form.get('buildingId')!.setValue('bld-res');
    component.form.get('floorId')!.setValue('flr-grd');
    component.form.get('wingId')!.setValue('wng-main');

    component.form.get('floorId')!.setValue('flr-grd');
    expect(component.form.get('wingId')?.value).toBe('');
    expect(component.form.get('buildingId')?.value).toBe('bld-res');
  });

  it('does not submit when any of Site/Building/Floor/Wing/Flat Code/Flat Number/Flat Name are empty', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    flushLookups();
    const component = fixture.componentInstance as TestableFlatFormDialog;

    component.onSubmit();

    expect(dialogRefCloseSpy).not.toHaveBeenCalled();
    httpMock.expectNone(apiUrl('master/flat/add'));
  });

  it('preserves a leading-zero Flat Number exactly as typed (never coerced to a number)', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    flushLookups();
    const component = fixture.componentInstance as TestableFlatFormDialog;

    component.form.get('siteId')!.setValue('site-sinr');
    component.form.get('buildingId')!.setValue('bld-res');
    component.form.get('floorId')!.setValue('flr-grd');
    component.form.patchValue({ wingId: 'wng-main', flatCode: 'G007', flatNumber: '007', flatName: 'Ground 007' });
    component.onSubmit();

    const req = httpMock.expectOne(apiUrl('master/flat/add'));
    expect(req.request.body.flatNumber).toBe('007');
    req.flush({ success: true, data: null });

    expect(dialogRefCloseSpy).toHaveBeenCalledWith(true);
  });

  it('trims leading/trailing spaces from Flat Code and Flat Name on submit', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    flushLookups();
    const component = fixture.componentInstance as TestableFlatFormDialog;

    component.form.get('siteId')!.setValue('site-sinr');
    component.form.get('buildingId')!.setValue('bld-res');
    component.form.get('floorId')!.setValue('flr-grd');
    component.form.patchValue({ wingId: 'wng-main', flatCode: '  G001  ', flatNumber: '1', flatName: '  Ground 001  ' });
    component.onSubmit();

    const req = httpMock.expectOne(apiUrl('master/flat/add'));
    expect(req.request.body.flatCode).toBe('G001');
    expect(req.request.body.flatName).toBe('Ground 001');
    req.flush({ success: true, data: null });
  });

  it('submits to master/flat/edit with the existing flatId and restores the saved relationship, even for a now-ineligible Building', () => {
    const existingRow: FlatRow = { flatId: 'f1', siteId: 'site-sinr', buildingId: 'bld-inactive', floorId: 'flr-grd', wingId: 'wng-main', flatCode: 'G001', flatName: 'Ground 001', flatNumber: '1', isActive: true };
    const fixture = createComponent({ row: existingRow, mode: 'edit' });
    flushLookups();
    const component = fixture.componentInstance as TestableFlatFormDialog;

    // The saved Building (now inactive) is still preserved as selectable
    // on Edit — this file's own class-level comment.
    expect(component.form.get('buildingId')?.value).toBe('bld-inactive');
    expect(component.buildingOptions().map((o) => o.value)).toContain('bld-inactive');

    component.onSubmit();

    const req = httpMock.expectOne(apiUrl('master/flat/edit'));
    expect(req.request.body.flatId).toBe('f1');
    req.flush({ success: true, data: null });

    expect(dialogRefCloseSpy).toHaveBeenCalledWith(true);
  });

  it('surfaces the real backend rejection message if a save is rejected (e.g. an ineligible Building)', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    flushLookups();
    const component = fixture.componentInstance as TestableFlatFormDialog;

    component.form.get('siteId')!.setValue('site-sinr');
    component.form.get('buildingId')!.setValue('bld-res');
    component.form.get('floorId')!.setValue('flr-grd');
    component.form.patchValue({ wingId: 'wng-main', flatCode: 'G001', flatNumber: '1', flatName: 'Ground 001' });
    component.onSubmit();

    const req = httpMock.expectOne(apiUrl('master/flat/add'));
    req.flush({ success: false, message: 'Only active RESIDENTIAL buildings can have Flats.', data: null });

    expect(component.errorMessage()).toBe('Only active RESIDENTIAL buildings can have Flats.');
    expect(dialogRefCloseSpy).not.toHaveBeenCalled();
  });
});
