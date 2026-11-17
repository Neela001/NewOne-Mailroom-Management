import { TestBed } from '@angular/core/testing';
import { DIALOG_DATA } from '../../../shared/ui/dialog/dialog-data.token';
import { DialogRef } from '../../../shared/ui/dialog/dialog-ref';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { FormGroup } from '@angular/forms';
import { WingFormDialogComponent, WingFormDialogData } from './wing-form-dialog.component';
import { ConfigService } from '../../../core/services/config.service';
import { WingRow } from './wing.model';
import { SelectOption } from '../../../shared/ui/form/select.component';
import { provideAppIcons } from '../../../shared/ui/icon/lucide-icons.provider';

type TestableWingFormDialog = WingFormDialogComponent & {
  form: FormGroup;
  siteOptions: () => SelectOption[];
  buildingOptions: () => SelectOption[];
  floorOptions: () => SelectOption[];
  helperText: () => string;
};

const SITE_ROWS = [
  { SiteId: 'site-chn', SiteCode: 'CHN01', SiteName: 'Chennai Corporate Site', IsActive: true },
  { SiteId: 'site-sinr', SiteCode: 'SINR', SiteName: 'Sivanthi Nagar', IsActive: true },
];

const BUILDING_ROWS = [
  { BuildingId: 'bld-a', SiteId: 'site-chn', BuildingCode: 'BLD-A', BuildingName: 'Corporate Tower A', IsActive: true },
  { BuildingId: 'bld-c', SiteId: 'site-chn', BuildingCode: 'BLD-C', BuildingName: 'Corporate Tower C', IsActive: true },
  { BuildingId: 'bld-b', SiteId: 'site-sinr', BuildingCode: 'SKKS', BuildingName: 'KRISHANYA', IsActive: true },
];

const FLOOR_ROWS = [
  { FloorId: 'flr-01', BuildingId: 'bld-a', FloorCode: '01', FloorName: 'First Floor', IsActive: true },
  { FloorId: 'flr-grd', BuildingId: 'bld-b', FloorCode: 'GRD', FloorName: 'Ground Floor', IsActive: true },
];

// Covers the Site -> Building -> Floor 3-level dependency logic this task
// calls out as critical (Building disabled until a Site is chosen, Floor
// disabled until a Building is chosen, each client-side filtered to its
// own real parent, cleared on the correct reset cascade — Site clears
// Building+Floor, Building clears Floor only, Floor retains Site and
// Building), and the dynamic "Select X to continue." helper text this
// task's own Section 2 explicitly requires.
describe('WingFormDialogComponent', () => {
  let httpMock: HttpTestingController;
  let dialogRefCloseSpy: ReturnType<typeof vi.fn>;

  function apiUrl(path: string): string {
    return `${TestBed.inject(ConfigService).getApiUrl()}${path}`;
  }

  function createComponent(data: WingFormDialogData) {
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
    const fixture = TestBed.createComponent(WingFormDialogComponent);
    fixture.detectChanges();
    return fixture;
  }

  function flushLookups(sites: Record<string, unknown>[] = SITE_ROWS, buildings: Record<string, unknown>[] = BUILDING_ROWS, floors: Record<string, unknown>[] = FLOOR_ROWS) {
    httpMock.expectOne(apiUrl('master/site/get')).flush({ success: true, data: sites });
    httpMock.expectOne(apiUrl('master/building/get')).flush({ success: true, data: buildings });
    httpMock.expectOne(apiUrl('master/floor/get')).flush({ success: true, data: floors });
  }

  afterEach(() => httpMock.verify());

  it('shows "Select Site to continue." before any Site is chosen', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    flushLookups();
    const component = fixture.componentInstance as TestableWingFormDialog;

    expect(component.helperText()).toBe('Select Site to continue.');
    expect(component.form.get('buildingId')?.disabled).toBe(true);
    expect(component.form.get('floorId')?.disabled).toBe(true);
  });

  it('shows "Select Building to continue." once a Site is chosen, and loads only that Site\'s buildings', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    flushLookups();
    const component = fixture.componentInstance as TestableWingFormDialog;

    component.form.get('siteId')!.setValue('site-chn');

    expect(component.helperText()).toBe('Select Building to continue.');
    expect(component.form.get('buildingId')?.disabled).toBe(false);
    expect(component.form.get('floorId')?.disabled).toBe(true);
    expect(component.buildingOptions().map((o) => o.label)).toEqual(['Corporate Tower A (BLD-A)', 'Corporate Tower C (BLD-C)']);
  });

  it('shows "Select Floor to continue." once a Building is chosen, and loads only that Building\'s floors', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    flushLookups();
    const component = fixture.componentInstance as TestableWingFormDialog;

    component.form.get('siteId')!.setValue('site-chn');
    component.form.get('buildingId')!.setValue('bld-a');

    expect(component.helperText()).toBe('Select Floor to continue.');
    expect(component.form.get('floorId')?.disabled).toBe(false);
    expect(component.floorOptions().map((o) => o.label)).toEqual(['First Floor (01)']);
  });

  it('shows the completion hint once Site, Building and Floor are all chosen', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    flushLookups();
    const component = fixture.componentInstance as TestableWingFormDialog;

    component.form.get('siteId')!.setValue('site-chn');
    component.form.get('buildingId')!.setValue('bld-a');
    component.form.get('floorId')!.setValue('flr-01');

    expect(component.helperText()).toBe('Enter Wing Code and Wing Name, then save.');
  });

  it('clears Building AND Floor when the Site changes', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    flushLookups();
    const component = fixture.componentInstance as TestableWingFormDialog;

    component.form.get('siteId')!.setValue('site-chn');
    component.form.get('buildingId')!.setValue('bld-a');
    component.form.get('floorId')!.setValue('flr-01');

    component.form.get('siteId')!.setValue('site-sinr');
    expect(component.form.get('buildingId')?.value).toBe('');
    expect(component.form.get('floorId')?.value).toBe('');
    expect(component.form.get('floorId')?.disabled).toBe(true);
  });

  it('clears only Floor (not Site or Building) when the Building changes', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    flushLookups();
    const component = fixture.componentInstance as TestableWingFormDialog;

    component.form.get('siteId')!.setValue('site-chn');
    component.form.get('buildingId')!.setValue('bld-a');
    component.form.get('floorId')!.setValue('flr-01');

    component.form.get('buildingId')!.setValue('bld-c');
    expect(component.form.get('floorId')?.value).toBe('');
    expect(component.form.get('siteId')?.value).toBe('site-chn');
  });

  it('does not submit when Site/Building/Floor/Wing Code/Wing Name are empty', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    flushLookups();
    const component = fixture.componentInstance as TestableWingFormDialog;

    component.onSubmit();

    expect(dialogRefCloseSpy).not.toHaveBeenCalled();
    httpMock.expectNone(apiUrl('master/wing/add'));
  });

  it('trims leading/trailing spaces from Wing Code and Wing Name on submit', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    flushLookups();
    const component = fixture.componentInstance as TestableWingFormDialog;

    component.form.get('siteId')!.setValue('site-chn');
    component.form.get('buildingId')!.setValue('bld-a');
    component.form.patchValue({ floorId: 'flr-01', wingCode: '  MAN  ', wingName: '  Main Wing  ' });
    component.onSubmit();

    const req = httpMock.expectOne(apiUrl('master/wing/add'));
    expect(req.request.body.wingCode).toBe('MAN');
    expect(req.request.body.wingName).toBe('Main Wing');
    req.flush({ success: true, data: null });

    expect(dialogRefCloseSpy).toHaveBeenCalledWith(true);
  });

  it('submits to master/wing/add with siteId, buildingId and floorId all set', () => {
    const fixture = createComponent({ row: null, mode: 'add' });
    flushLookups();
    const component = fixture.componentInstance as TestableWingFormDialog;

    component.form.get('siteId')!.setValue('site-chn');
    component.form.get('buildingId')!.setValue('bld-a');
    component.form.patchValue({ floorId: 'flr-01', wingCode: 'MAN', wingName: 'Main Wing' });
    component.onSubmit();

    const req = httpMock.expectOne(apiUrl('master/wing/add'));
    expect(req.request.body.siteId).toBe('site-chn');
    expect(req.request.body.buildingId).toBe('bld-a');
    expect(req.request.body.floorId).toBe('flr-01');
    req.flush({ success: true, data: null });
  });

  it('submits to master/wing/edit with the existing wingId and restores the saved relationship', () => {
    const existingRow: WingRow = { wingId: 'w1', siteId: 'site-chn', buildingId: 'bld-a', floorId: 'flr-01', wingCode: 'MAN', wingName: 'Main Wing', isActive: true };
    const fixture = createComponent({ row: existingRow, mode: 'edit' });
    flushLookups();
    const component = fixture.componentInstance as TestableWingFormDialog;

    expect(component.form.get('siteId')?.value).toBe('site-chn');
    expect(component.form.get('buildingId')?.value).toBe('bld-a');
    expect(component.form.get('floorId')?.value).toBe('flr-01');

    component.onSubmit();

    const req = httpMock.expectOne(apiUrl('master/wing/edit'));
    expect(req.request.body.wingId).toBe('w1');
    req.flush({ success: true, data: null });

    expect(dialogRefCloseSpy).toHaveBeenCalledWith(true);
  });
});
